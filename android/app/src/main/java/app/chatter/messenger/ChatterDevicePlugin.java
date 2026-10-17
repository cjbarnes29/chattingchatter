package app.chatter.messenger;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Phone features the web view can't reach on its own: runtime permissions with their real state,
 * fingerprint / face checks (BiometricPrompt), reminder notifications, saving a file the user picks
 * a place for, and opening this app's page in phone settings.
 *
 * Nothing here is requested on its own. The app asks only when the user starts the feature that needs it.
 */
@CapacitorPlugin(
    name = "ChatterDevice",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class ChatterDevicePlugin extends Plugin {

    private static final String CHANNEL_ID = "reminders";
    private static final int STRONG = BiometricManager.Authenticators.BIOMETRIC_STRONG;

    private String stateOf(String alias) {
        if ("notifications".equals(alias)) {
            boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
            // Before Android 13 there is no notification prompt: they're on unless turned off in settings.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return enabled ? "granted" : "denied";
            PermissionState s = getPermissionState(alias);
            if (s == PermissionState.GRANTED) return enabled ? "granted" : "denied";
            return s.toString();
        }
        return getPermissionState(alias).toString();
    }

    private String biometricState() {
        switch (BiometricManager.from(getContext()).canAuthenticate(STRONG)) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return "available";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "not-enrolled";
            default:
                return "unavailable";
        }
    }

    private JSObject status() {
        JSObject r = new JSObject();
        r.put("camera", stateOf("camera"));
        r.put("microphone", stateOf("microphone"));
        r.put("notifications", stateOf("notifications"));
        r.put("biometric", biometricState());
        return r;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void request(PluginCall call) {
        String name = call.getString("name", "");
        if (!"camera".equals(name) && !"microphone".equals(name) && !"notifications".equals(name)) {
            call.reject("Unknown permission");
            return;
        }
        boolean noPrompt = "notifications".equals(name) && Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU;
        if (noPrompt || getPermissionState(name) == PermissionState.GRANTED) {
            call.resolve(status());
            return;
        }
        requestPermissionForAlias(name, call, "afterRequest");
    }

    @PermissionCallback
    private void afterRequest(PluginCall call) {
        call.resolve(status());
    }

    /** Opens this app's page in phone settings, where every permission can be changed. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Strong (class 3) fingerprint or face only. A failed or cancelled check resolves ok=false. */
    @PluginMethod
    public void verifyBiometric(PluginCall call) {
        if (BiometricManager.from(getContext()).canAuthenticate(STRONG) != BiometricManager.BIOMETRIC_SUCCESS) {
            JSObject r = new JSObject();
            r.put("ok", false);
            r.put("code", biometricState());
            call.resolve(r);
            return;
        }
        String title = call.getString("title", "Unlock Chatter");
        String subtitle = call.getString("subtitle", "");
        getActivity().runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(
                getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        JSObject r = new JSObject();
                        r.put("ok", true);
                        call.resolve(r);
                    }

                    @Override
                    public void onAuthenticationError(int code, CharSequence msg) {
                        JSObject r = new JSObject();
                        r.put("ok", false);
                        boolean cancelled = code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON || code == BiometricPrompt.ERROR_CANCELED;
                        r.put("code", cancelled ? "cancelled" : code == BiometricPrompt.ERROR_LOCKOUT || code == BiometricPrompt.ERROR_LOCKOUT_PERMANENT ? "lockout" : "error");
                        r.put("message", msg.toString());
                        call.resolve(r);
                    }
                    // onAuthenticationFailed (finger not recognised) keeps the prompt open for another try.
                }
            );
            BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setAllowedAuthenticators(STRONG)
                .setNegativeButtonText("Use PIN");
            if (!subtitle.isEmpty()) info.setSubtitle(subtitle);
            prompt.authenticate(info.build());
        });
    }

    /** Shows a notification now (event reminders). Does nothing if notifications are off. */
    @PluginMethod
    public void showNotification(PluginCall call) {
        if (!"granted".equals(stateOf("notifications"))) {
            call.resolve();
            return;
        }
        NotificationManagerCompat nm = NotificationManagerCompat.from(getContext());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Event reminders", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Reminders for events you add in Chatter");
            getContext().getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
        Intent open = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
        PendingIntent tap = PendingIntent.getActivity(getContext(), 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_chatter)
            .setContentTitle(call.getString("title", "Chatter"))
            .setContentText(call.getString("body", ""))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(call.getString("body", "")))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(tap)
            .setAutoCancel(true);
        try {
            nm.notify(call.getString("id", "chatter").hashCode(), b.build());
        } catch (SecurityException e) {
            // permission was withdrawn between the check and now
        }
        call.resolve();
    }

    /** Lets the user choose where to save a text file (system file picker; no storage permission needed). */
    @PluginMethod
    public void saveFile(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(call.getString("mime", "application/octet-stream"));
        i.putExtra(Intent.EXTRA_TITLE, call.getString("name", "file"));
        startActivityForResult(call, i, "afterSave");
    }

    @ActivityCallback
    private void afterSave(PluginCall call, ActivityResult result) {
        JSObject r = new JSObject();
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null) {
            r.put("saved", false);
            call.resolve(r);
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new java.io.IOException("no stream");
            out.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
            r.put("saved", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Couldn't save the file");
        }
    }
}
