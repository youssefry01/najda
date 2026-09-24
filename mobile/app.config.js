const IS_TEST = process.env.APP_VARIANT === "test";

const appId = IS_TEST ? "com.najda.mobile.test" : "com.najda.mobile";
const webUrl = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";
const host = webUrl ? new URL(webUrl).host : "";

export default {
  expo: {
    name: IS_TEST ? "Najda (Test)" : "Najda",
    slug: "najda-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: appId,
    userInterfaceStyle: "automatic",
    assetBundlePatterns: ["**/*"],
    ios: {
      icon: "./assets/favicon.ico",
      supportsTablet: true,
      bundleIdentifier: appId,
      config: { usesNonExemptEncryption: false },
      associatedDomains: host ? [`applinks:${host}`] : [],
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "NAJDA uses your location to attach it to the emergency you report and, for on-duty responders, to share live position with dispatch.",
        NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["com.googleusercontent.apps.YOUR_IOS_CLIENT_ID_REVERSED"]
          }
        ]
      },
    },
    android: {
      package: appId,
      adaptiveIcon: {
        backgroundColor: "#ffffff",
        foregroundImage: IS_TEST
          ? "./assets/adaptive-icon-test.png"
          : "./assets/adaptive-icon.png",
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
      ],
      intentFilters: host
        ? [
            {
              action: "VIEW",
              autoVerify: true,
              data: [{ scheme: "https", host, pathPrefix: "/auth/action" }],
              category: ["BROWSABLE", "DEFAULT"],
            },
          ]
        : [],
    },
    web: {
      output: "static",
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#ffffff",
          image: "./assets/splash.png",
          imageWidth: 76,
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "NAJDA uses your location to attach it to the emergency you report and, for on-duty responders, to share live position with dispatch.",
        },
      ],
      "expo-localization",
      "@react-native-google-signin/google-signin",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "57fc4e1d-2ac3-49eb-ba28-df8a13df436c",
      },
    },
  },
};