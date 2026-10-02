/**
 * Validates a date of birth string in YYYY-MM-DD format
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Object with isValid boolean and optional error type
 */
export interface DateValidationResult {
    isValid: boolean;
    error?: "empty" | "invalidFormat" | "tooYoung";
}

export const validateDateOfBirth = (dateString: string): DateValidationResult => {
    // Check if date is empty
    if (!dateString || !dateString.trim()) {
        return { isValid: false, error: "empty" };
    }

    const trimmedDate = dateString.trim();

    // Validate format: YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(trimmedDate)) {
        return { isValid: false, error: "invalidFormat" };
    }

    // Validate it's a real date by parsing it
    // Add T00:00:00 to ensure we're parsing as local midnight, not UTC
    const date = new Date(trimmedDate + "T00:00:00");

    // Check if the date is invalid (e.g., 2024-02-30)
    if (isNaN(date.getTime())) {
        return { isValid: false, error: "invalidFormat" };
    }

    // Verify the parsed date matches the input string (handles cases like 2024-02-30 being parsed as March 2)
    const [year, month, day] = trimmedDate.split("-").map(Number);
    if (
        date.getFullYear() !== year ||
        date.getMonth() + 1 !== month ||
        date.getDate() !== day
    ) {
        return { isValid: false, error: "invalidFormat" };
    }

    // Validate not in future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
        return { isValid: false, error: "invalidFormat" };
    }

    // Validate age >= 5 years
    // Calculate the date 5 years ago from today
    const ageThreshold = new Date(today);
    ageThreshold.setFullYear(today.getFullYear() - 5);
    ageThreshold.setHours(0, 0, 0, 0);

    // If the birth date is after the threshold, user is too young
    if (date > ageThreshold) {
        return { isValid: false, error: "tooYoung" };
    }

    return { isValid: true };
};
