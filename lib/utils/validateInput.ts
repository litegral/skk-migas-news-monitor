/**
 * Input validation utilities for strict validation.
 * Used for user inputs in settings and forms.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: string;
}

/**
 * Validate a required string field.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @param options - Validation options
 * @returns Validation result with trimmed value if valid
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options: {
    /** Minimum length after trimming. Default: 1 */
    minLength?: number;
    /** Maximum length after trimming. Default: 255 */
    maxLength?: number;
    /** Custom regex pattern to match */
    pattern?: RegExp;
    /** Error message for pattern mismatch */
    patternError?: string;
    /** Allow empty string. Default: false */
    allowEmpty?: boolean;
  } = {}
): ValidationResult {
  const {
    minLength = 1,
    maxLength = 255,
    pattern,
    patternError,
    allowEmpty = false,
  } = options;

  // Check type
  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  // Trim whitespace
  const trimmed = value.trim();

  // Check empty
  if (!trimmed && !allowEmpty) {
    return { valid: false, error: `${fieldName} is required` };
  }

  // If empty is allowed and value is empty, return early
  if (!trimmed && allowEmpty) {
    return { valid: true, value: "" };
  }

  // Check length
  if (trimmed.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} character${minLength === 1 ? "" : "s"}`,
    };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be at most ${maxLength} characters`,
    };
  }

  // Check pattern
  if (pattern && !pattern.test(trimmed)) {
    return {
      valid: false,
      error: patternError || `${fieldName} has invalid format`,
    };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validate a UUID string.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns Validation result
 */
export function validateUuid(value: unknown, fieldName: string): ValidationResult {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (!UUID_REGEX.test(trimmed)) {
    return { valid: false, error: `${fieldName} must be a valid UUID` };
  }

  return { valid: true, value: trimmed.toLowerCase() };
}

/**
 * Validate a boolean value.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns Validation result with boolean value
 */
export function validateBoolean(
  value: unknown,
  fieldName: string
): { valid: boolean; error?: string; value?: boolean } {
  if (typeof value !== "boolean") {
    return { valid: false, error: `${fieldName} must be a boolean` };
  }
  return { valid: true, value };
}

/**
 * Validate a positive integer.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @param options - Validation options
 * @returns Validation result with number value
 */
export function validatePositiveInt(
  value: unknown,
  fieldName: string,
  options: {
    /** Minimum value. Default: 1 */
    min?: number;
    /** Maximum value. Default: Number.MAX_SAFE_INTEGER */
    max?: number;
  } = {}
): { valid: boolean; error?: string; value?: number } {
  const { min = 1, max = Number.MAX_SAFE_INTEGER } = options;

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { valid: false, error: `${fieldName} must be an integer` };
  }

  if (value < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (value > max) {
    return { valid: false, error: `${fieldName} must be at most ${max}` };
  }

  return { valid: true, value };
}

/**
 * Combine multiple validation results.
 * Returns the first error found, or a success result.
 *
 * @param results - Array of validation results
 * @returns Combined validation result
 */
export function combineValidations(
  results: ValidationResult[]
): { valid: boolean; errors: string[] } {
  const errors = results.filter((r) => !r.valid).map((r) => r.error!);
  return {
    valid: errors.length === 0,
    errors,
  };
}
