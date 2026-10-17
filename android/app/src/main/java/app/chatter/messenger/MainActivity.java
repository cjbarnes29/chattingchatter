package app.chatter.messenger;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ChatterDevicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
