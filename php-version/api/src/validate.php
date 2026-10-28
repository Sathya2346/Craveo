<?php

declare(strict_types=1);

/**
 * Declarative request validator.
 *
 *   $data = Validator::validate($body, [
 *     'name'  => 'required|string|min:2|max:100',
 *     'email' => 'required|email|lower|max:190',
 *     'phone' => 'nullable|phone',
 *   ], ['name' => 'Name is required']);
 *
 * Only keys present in the input (plus declared defaults) end up in the result,
 * which keeps PATCH requests partial. Failures throw a 400 with per-field details.
 */
final class Validator
{
    private array $values = [];
    private array $errors = [];

    public static function query(array $rules, array $messages = []): array
    {
        return self::validate($_GET, $rules, $messages);
    }

    public static function validate(?array $input, array $rules, array $messages = []): array
    {
        $validator = new self();
        $input = $input ?? [];

        foreach ($rules as $field => $ruleString) {
            $validator->applyField($field, $ruleString, $input, $messages);
        }

        if ($validator->errors !== []) {
            bad_request('Please check the highlighted fields', $validator->errors);
        }

        return $validator->values;
    }

    private function applyField(string $field, string $ruleString, array $input, array $messages): void
    {
        $rules = explode('|', $ruleString);
        $present = array_key_exists($field, $input);
        $value = $input[$field] ?? null;

        $required = in_array('required', $rules, true);
        $nullable = in_array('nullable', $rules, true);
        $label = $this->label($field);
        $errorFor = static fn (string $rule, string $fallback): string => $messages[$field . '.' . $rule]
            ?? $messages[$field]
            ?? $fallback;

        if (!$present) {
            foreach ($rules as $rule) {
                if (str_starts_with($rule, 'default:')) {
                    $this->values[$field] = substr($rule, 8);
                    return;
                }
            }
            if ($required) {
                $this->errors[] = ['field' => $field, 'message' => $errorFor('required', $label . ' is required')];
            }
            return;
        }

        if (is_string($value)) {
            $value = trim($value);
        }

        if ($value === null || $value === '') {
            if ($nullable) {
                $this->values[$field] = null;
                return;
            }
            if ($required) {
                $this->errors[] = ['field' => $field, 'message' => $errorFor('required', $label . ' is required')];
                return;
            }
            $this->values[$field] = $value === '' ? null : $value;
            return;
        }

        // --- scalar coercion -------------------------------------------------
        foreach ($rules as $rule) {
            [$name, $argument] = array_pad(explode(':', $rule, 2), 2, null);

            switch ($name) {
                case 'string':
                    $value = is_scalar($value) ? (string) $value : $value;
                    break;

                case 'int':
                    if (!is_numeric($value) || (string) (int) $value !== (string) $value) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('int', $label . ' must be a whole number')];
                        return;
                    }
                    $value = (int) $value;
                    break;

                case 'float':
                case 'number':
                    if (!is_numeric($value)) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('number', $label . ' must be a number')];
                        return;
                    }
                    $value = (float) $value;
                    break;

                case 'bool':
                    if (is_bool($value)) {
                        break;
                    }
                    $normalised = strtolower((string) $value);
                    if (!in_array($normalised, ['1', '0', 'true', 'false', 'on', 'off', 'yes', 'no'], true)) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('bool', $label . ' must be true or false')];
                        return;
                    }
                    $value = in_array($normalised, ['1', 'true', 'on', 'yes'], true);
                    break;

                case 'lower':
                    $value = is_string($value) ? strtolower($value) : $value;
                    break;

                case 'email':
                    if (!filter_var((string) $value, FILTER_VALIDATE_EMAIL)) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('email', 'Enter a valid email address')];
                        return;
                    }
                    break;

                case 'phone':
                    if (preg_match('/^[0-9+\-\s()]{6,20}$/', (string) $value) !== 1) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('phone', 'Enter a valid phone number')];
                        return;
                    }
                    break;

                case 'pincode':
                    if (preg_match('/^[0-9]{5,6}$/', (string) $value) !== 1) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('pincode', 'Enter a valid pincode')];
                        return;
                    }
                    break;

                case 'imageUrl':
                    if (!image_url_is_valid((string) $value)) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('imageUrl', 'Enter a valid image URL')];
                        return;
                    }
                    break;

                case 'datetime':
                    if (strtotime((string) $value) === false) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('datetime', 'Enter a valid date')];
                        return;
                    }
                    break;

                case 'hex':
                    if (preg_match('/^#[0-9a-fA-F]{6}$/', (string) $value) !== 1) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('hex', 'Use a hex colour like #ff5a1f')];
                        return;
                    }
                    break;

                case 'in':
                    $allowed = explode(',', (string) $argument);
                    if (!in_array((string) $value, $allowed, true)) {
                        $this->errors[] = [
                            'field' => $field,
                            'message' => $errorFor('in', $label . ' must be one of: ' . implode(', ', $allowed)),
                        ];
                        return;
                    }
                    break;

                case 'regex':
                    if (preg_match((string) $argument, (string) $value) !== 1) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('regex', $label . ' is not valid')];
                        return;
                    }
                    break;

                case 'positive':
                    if ((float) $value <= 0) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('positive', $label . ' must be greater than 0')];
                        return;
                    }
                    break;

                case 'min':
                    if (is_numeric($value) && !is_string($value)) {
                        if ((float) $value < (float) $argument) {
                            $this->errors[] = ['field' => $field, 'message' => $errorFor('min', $label . ' must be at least ' . $argument)];
                            return;
                        }
                    } elseif (mb_strlen((string) $value) < (int) $argument) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('min', $label . ' must be at least ' . $argument . ' characters')];
                        return;
                    }
                    break;

                case 'max':
                    if (is_numeric($value) && !is_string($value)) {
                        if ((float) $value > (float) $argument) {
                            $this->errors[] = ['field' => $field, 'message' => $errorFor('max', $label . ' must be at most ' . $argument)];
                            return;
                        }
                    } elseif (mb_strlen((string) $value) > (int) $argument) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('max', $label . ' must be ' . $argument . ' characters or less')];
                        return;
                    }
                    break;

                case 'minitems':
                    if (!is_array($value) || count($value) < (int) $argument) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('minitems', $label . ' needs at least ' . $argument . ' item(s)')];
                        return;
                    }
                    break;

                case 'maxitems':
                    if (is_array($value) && count($value) > (int) $argument) {
                        $this->errors[] = ['field' => $field, 'message' => $errorFor('maxitems', $label . ' allows at most ' . $argument . ' item(s)')];
                        return;
                    }
                    break;
            }
        }

        $this->values[$field] = $value;
    }

    private function label(string $field): string
    {
        $spaced = preg_replace('/(?<!^)[A-Z]/', ' $0', $field) ?? $field;
        return ucfirst(strtolower($spaced));
    }
}
