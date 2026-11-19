package com.dm.chat;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int AUDIO_PERMISSION_REQUEST = 4102;
    private static final String PREFS = "dm_native";
    private static final String THEME_KEY = "launcher_theme";

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingPermissionRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#E9DFC8"));
        window.setNavigationBarColor(Color.parseColor("#E9DFC8"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#E9DFC8"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " DMAndroid/1.0");

        webView.addJavascriptInterface(new ThemeBridge(), "DMNative");
        applyLauncherTheme(getPreferences(MODE_PRIVATE).getString(THEME_KEY, "light"));

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(Uri.parse(url));
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(Intent.createChooser(intent, "选择文件"), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception error) {
                    fileCallback = null;
                    return false;
                }
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                boolean wantsAudio = false;
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) wantsAudio = true;
                }
                if (!wantsAudio) {
                    request.deny();
                    return;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    pendingPermissionRequest = request;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
                    return;
                }
                request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            }
        });

        webView.loadUrl("file:///android_asset/www/index.html");
    }

    public class ThemeBridge {
        @JavascriptInterface
        public boolean saveFile(String filename, String encoded) {
            try {
                byte[] data = Base64.decode(encoded, Base64.DEFAULT);
                if (data.length > 20 * 1024 * 1024) return false;
                String safe = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/D&M");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        OutputStream out = getContentResolver().openOutputStream(uri);
                        out.write(data);
                        out.close();
                    }
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "D&M");
                    if (!dir.exists()) dir.mkdirs();
                    FileOutputStream out = new FileOutputStream(new File(dir, safe));
                    out.write(data);
                    out.close();
                }
                runOnUiThread(new Runnable() {
                    public void run() {
                        Toast.makeText(MainActivity.this, "已导出到下载目录", Toast.LENGTH_SHORT).show();
                    }
                });
                return true;
            } catch (Exception ignored) {
                return false;
            }
        }

        @JavascriptInterface
        public void setTheme(String theme) {
            if (!"dark".equals(theme) && !"light".equals(theme)) return;
            getPreferences(MODE_PRIVATE).edit().putString(THEME_KEY, theme).apply();
            final String nextTheme = theme;
            runOnUiThread(new Runnable() {
                public void run() {
                    applyLauncherTheme(nextTheme);
                }
            });
        }
    }

    private void applyLauncherTheme(String theme) {
        boolean dark = "dark".equals(theme);
        ComponentName light = new ComponentName(this, getPackageName() + ".LightIcon");
        ComponentName darkIcon = new ComponentName(this, getPackageName() + ".DarkIcon");
        try {
            if (dark) {
                getPackageManager().setComponentEnabledSetting(darkIcon, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
                getPackageManager().setComponentEnabledSetting(light, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            } else {
                getPackageManager().setComponentEnabledSetting(light, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
                getPackageManager().setComponentEnabledSetting(darkIcon, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            }
        } catch (Exception ignored) {
            // Launcher icon switching is best-effort across OEM launchers.
        }
    }

    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        if ("file".equals(scheme) || "blob".equals(scheme) || "about".equals(scheme)) return false;
        if ("https".equals(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
                // No browser installed.
            }
            return true;
        }
        return true;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileCallback == null) return;
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == AUDIO_PERMISSION_REQUEST) {
            if (pendingPermissionRequest != null) {
                boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
                if (granted) {
                    pendingPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    pendingPermissionRequest.deny();
                    Toast.makeText(this, "需要麦克风权限才能语音输入", Toast.LENGTH_SHORT).show();
                }
                pendingPermissionRequest = null;
            }
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
