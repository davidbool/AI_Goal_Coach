import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";

import {
  ActionButton,
  ErrorBanner,
  HeroBadge,
  HeroPanel,
  SegmentedControl
} from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function WelcomeScreen({
  apiBaseUrl,
  authDraft,
  authMode,
  busyLabel,
  errorMessage,
  onChangeApiBaseUrl,
  onChangeAuthField,
  onContinueAsGuest,
  onSelectAuthMode,
  onSubmitAuth
}) {
  const isBusy = busyLabel.length > 0;
  const primaryActionLabel =
    authMode === "sign_up"
      ? (isBusy ? busyLabel : "Create my account")
      : (isBusy ? busyLabel : "Sign in");

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.welcomeContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HeroPanel
          eyebrow="AI Goal Coach"
          title="Calm daily coaching for one meaningful goal."
          copy="Create a real account with Firebase Auth, save your coaching state to a real user identity, and keep the daily flow focused on one goal that matters."
        >
          <View style={styles.heroStatRow}>
            <HeroBadge label="Theme" value="Bright / clear" />
            <HeroBadge label="Mode" value="Firebase auth" />
          </View>
        </HeroPanel>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Start with your account</Text>
          <Text style={styles.mutedCopy}>
            Use email and password first so the app starts behaving like a real product instead of a local preview.
          </Text>
          <SegmentedControl
            onChange={onSelectAuthMode}
            options={[
              { label: "Create account", value: "sign_up" },
              { label: "Sign in", value: "sign_in" }
            ]}
            value={authMode}
          />
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={(value) => onChangeAuthField("email", value)}
            placeholder="you@example.com"
            placeholderTextColor="#8A95A7"
            style={styles.input}
            textContentType="emailAddress"
            value={authDraft.email}
          />
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value) => onChangeAuthField("password", value)}
            placeholder="At least 6 characters"
            placeholderTextColor="#8A95A7"
            secureTextEntry
            style={styles.input}
            textContentType={authMode === "sign_up" ? "newPassword" : "password"}
            value={authDraft.password}
          />
          {authMode === "sign_up" ? (
            <>
              <Text style={styles.fieldLabel}>Confirm password</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(value) => onChangeAuthField("confirmPassword", value)}
                placeholder="Repeat the same password"
                placeholderTextColor="#8A95A7"
                secureTextEntry
                style={styles.input}
                textContentType="newPassword"
                value={authDraft.confirmPassword}
              />
            </>
          ) : null}
          <Text style={styles.helperLine}>
            {authMode === "sign_up"
              ? "Firebase will create the account and keep the session signed in on this device."
              : "Use the same Firebase email and password you already created."}
          </Text>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          <ActionButton
            disabled={isBusy}
            label={primaryActionLabel}
            onPress={onSubmitAuth}
            tone="primary"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Guest preview</Text>
          <Text style={styles.mutedCopy}>
            Keep this secondary path for demos and validation work while the real auth flow is coming online.
          </Text>
          <Text style={styles.fieldLabel}>API base URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={onChangeApiBaseUrl}
            placeholder="http://127.0.0.1:3000"
            placeholderTextColor="#8A95A7"
            style={styles.input}
            value={apiBaseUrl}
          />
          <Text style={styles.helperLine}>
            Use `127.0.0.1` for the iOS Simulator when the API is running locally.
          </Text>
          <ActionButton
            disabled={isBusy}
            label={isBusy ? busyLabel : "Continue as guest"}
            onPress={onContinueAsGuest}
            tone="secondary"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
