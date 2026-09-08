#!/usr/bin/env python3
"""Configure pinned native clients; public app key only, never an admin secret."""
from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
key=(root/'.runtime/client-key').read_text().strip()
android=root/'third_party/android'
p=android/'app/src/main/java/co/tinode/tindroid/Cache.java'
s=p.read_text();s=re.sub(r'private static final String API_KEY = "[^"]+";',f'private static final String API_KEY = "{key}";',s);p.write_text(s)
p=android/'app/build.gradle';s=p.read_text()
s=re.sub(r'^.*keystoreProperties.load.*$', 'if (keystorePropertiesFile.exists()) { keystoreProperties.load(new FileInputStream(keystorePropertiesFile)) }',s,flags=re.M)
s=s.replace("storeFile file(keystoreProperties['storeFile'])","storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null")
s=s.replace('sandbox.tinode.co','api.cyfljj.com').replace('api.tinode.co','api.cyfljj.com')
p.write_text(s)
# Keep existing namespace and App Groups until signed production identifiers are confirmed.
p=android/'app/src/main/AndroidManifest.xml'
s=p.read_text().replace('android:host="web.tinode.co"','android:host="im.cyfljj.com"');p.write_text(s)
for p in (android/'app/src/main/res').glob('values*/strings.xml'):
 s=p.read_text()
 s=re.sub(r'(<string name="app_name"[^>]*>).*?(</string>)',r'\1IM\2',s)
 p.write_text(s)
ios=root/'third_party/ios'
p=ios/'TinodiosDB/SharedUtils.swift';s=p.read_text()
s=re.sub(r'private static let kApiKey = "[^"]+"',f'private static let kApiKey = "{key}"',s)
s=re.sub(r'public static let kDefaultHostName = "[^"]+"','public static let kDefaultHostName = "api.cyfljj.com"',s)
s=s.replace('public static let kDefaultUseTLS = false','public static let kDefaultUseTLS = true');p.write_text(s)
for name in ('devel.xcconfig','prod.xcconfig'):
 p=ios/name;s=p.read_text()
 s=re.sub(r'^HOST_NAME = .*','HOST_NAME = api.cyfljj.com',s,flags=re.M)
 s=re.sub(r'^APP_NAME = .*','APP_NAME = IM',s,flags=re.M)
 s=s.replace('USE_TLS = NO','USE_TLS = YES');p.write_text(s)
print('Native endpoints configured. Push and production signing are not configured.')
p=android/'app/src/main/java/co/tinode/tindroid/TindroidApp.java'
s=p.read_text().replace('return !isEmulator();','return true;')
s=s.replace('sContext.getResources().getString(isEmulator() ?\n                R.string.emulator_host_name :\n                R.string.default_host_name)','sContext.getResources().getString(R.string.default_host_name)')
s=s.replace('        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(!BuildConfig.DEBUG);','if (!com.google.firebase.FirebaseApp.getApps(this).isEmpty()) { FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(!BuildConfig.DEBUG); }')
p.write_text(s)
p=android/'app/src/main/java/co/tinode/tindroid/Cache.java'
s=p.read_text().replace('FirebaseMessaging fbId = FirebaseMessaging.getInstance();','FirebaseMessaging fbId = com.google.firebase.FirebaseApp.getApps(TindroidApp.getAppContext()).isEmpty() ? null : FirebaseMessaging.getInstance();')
s=s.replace('        FirebaseMessaging.getInstance().deleteToken();','if (!com.google.firebase.FirebaseApp.getApps(TindroidApp.getAppContext()).isEmpty()) { FirebaseMessaging.getInstance().deleteToken(); }')
p.write_text(s)
p=android/'app/build.gradle';s=p.read_text()
# No dummy Firebase project: explicitly skip Google tasks only when configuration is absent.
marker='// IM optional Firebase configuration'
if marker not in s:
 s += """
// IM optional Firebase configuration
tasks.configureEach { task ->
    if (!file("google-services.json").exists() &&
        (task.name.contains("GoogleServices") || task.name.contains("Crashlytics"))) {
        task.enabled = false
    }
}
"""
p.write_text(s)
p=android/'gradle.properties'
s=p.read_text().replace(' -XX:MaxPermSize=1024m','').replace('-Xmx4096m','-Xmx1536m')
p.write_text(s)
