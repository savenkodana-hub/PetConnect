import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import AuthFormCard from '../components/AuthFormCard';
import { useAuth } from '../context/AuthContext';

const getErrorMessage = (error) =>
  error.response?.data?.message || 'Login failed. Please check your details.';

export default function LoginScreen({ navigation }) {
  const { login, authError, setAuthError } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (name, value) => {
    setAuthError('');
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email || !form.password) {
      setAuthError('Email and password are required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAuthError('Enter a valid email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login({ email, password: form.password });
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.heroBubble} />
      <AuthFormCard
        title="Welcome back"
        subtitle="Sign in to check your feed, pets, groups, and messages."
        fields={[
          {
            name: 'email',
            label: 'Email',
            placeholder: 'maya@example.com',
            value: form.email,
            keyboardType: 'email-address'
          },
          {
            name: 'password',
            label: 'Password',
            placeholder: 'password123',
            value: form.password,
            secureTextEntry: true
          }
        ]}
        buttonText="Log In"
        footerText="New to PetConnect?"
        footerActionText="Create account"
        error={authError}
        isSubmitting={isSubmitting}
        onChangeField={updateField}
        onSubmit={handleSubmit}
        onFooterPress={() => navigation.navigate('Register')}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#eef8f0'
  },
  heroBubble: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#ccebd6'
  }
});
