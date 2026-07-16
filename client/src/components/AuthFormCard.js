import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AuthFormCard({
  title,
  subtitle,
  fields,
  buttonText,
  footerText,
  footerActionText,
  error,
  isSubmitting,
  onChangeField,
  onSubmit,
  onFooterPress
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.logo}>PetConnect</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {fields.map((field) => (
        <View key={field.name} style={styles.inputGroup}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            value={field.value}
            onChangeText={(value) => onChangeField(field.name, value)}
            placeholder={field.placeholder}
            autoCapitalize={field.autoCapitalize || 'none'}
            keyboardType={field.keyboardType || 'default'}
            secureTextEntry={field.secureTextEntry}
            style={styles.input}
            placeholderTextColor="#8a9b91"
          />
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>{isSubmitting ? 'Please wait...' : buttonText}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.footer} onPress={onFooterPress}>
        <Text style={styles.footerText}>
          {footerText} <Text style={styles.footerAction}>{footerActionText}</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#173b2c',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  logo: {
    color: '#2f8f68',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 18
  },
  title: {
    color: '#173b2c',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8
  },
  subtitle: {
    color: '#5f7569',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24
  },
  inputGroup: {
    marginBottom: 14
  },
  label: {
    color: '#244536',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7e5dc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#173b2c',
    backgroundColor: '#fbfdfb',
    fontSize: 16
  },
  error: {
    color: '#b3261e',
    marginBottom: 14,
    lineHeight: 20
  },
  button: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16
  },
  footer: {
    alignItems: 'center',
    marginTop: 18
  },
  footerText: {
    color: '#5f7569'
  },
  footerAction: {
    color: '#2f8f68',
    fontWeight: '800'
  }
});
