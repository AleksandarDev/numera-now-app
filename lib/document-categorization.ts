/**
 * Document auto-categorization utility
 * Automatically categorizes documents based on filename patterns in Croatian and English
 */

export interface DocumentType {
    id: string;
    name: string;
    description?: string | null;
}

export interface CategorizationResult {
    documentTypeId: string | null;
    confidence: 'high' | 'medium' | 'low';
    matchedPattern?: string;
    suggestedTypeName?: string;
}

/**
 * Common document category patterns in Croatian and English
 * Each category maps to common filename patterns
 */
const CATEGORY_PATTERNS: Record<string, string[]> = {
    // Recipe / Recept
    recipe: [
        'recept',
        'recepti',
        'recipe',
        'recipes',
        'cooking',
        'kuhanje',
        'jelo',
        'kuharica',
    ],

    // Invoice / Račun
    invoice: [
        'račun',
        'racun',
        'faktura',
        'invoice',
        'bill',
        'payment',
        'uplata',
        'plaćanje',
        'placanje',
    ],

    // Receipt / Potvrda
    receipt: [
        'potvrda',
        'blagajnički',
        'blagajnicki',
        'receipt',
        'bon',
        'fiskal',
        'fiscal',
    ],

    // Contract / Ugovor
    contract: ['ugovor', 'contract', 'sporazum', 'agreement', 'pogodba'],

    // ID / Identification / Osobna
    identification: [
        'osobna',
        'identifikacija',
        'iskaznica',
        'id',
        'identification',
        'passport',
        'putovnica',
        'vozačka',
        'vozacka',
        'license',
    ],

    // Insurance / Osiguranje
    insurance: ['osiguranje', 'polica', 'insurance', 'policy'],

    // Tax / Porez
    tax: ['porez', 'porezni', 'tax', 'pdv', 'vat', 'joppd'],

    // Medical / Medicinski
    medical: [
        'medicinski',
        'liječnički',
        'lijecnicki',
        'nalaz',
        'recept',
        'medical',
        'doctor',
        'health',
        'zdravlje',
        'bolnica',
        'hospital',
    ],

    // Utility Bill / Režije
    utility: [
        'režije',
        'rezije',
        'struja',
        'plin',
        'voda',
        'komunalije',
        'utility',
        'electric',
        'gas',
        'water',
    ],

    // Bank Statement / Izvod
    bank: [
        'izvod',
        'banka',
        'bank',
        'statement',
        'account',
        'račun banke',
        'racun banke',
    ],

    // Salary / Plaća
    salary: [
        'plaća',
        'placa',
        'plata',
        'salary',
        'payslip',
        'wage',
        'obračun',
        'obracun',
    ],

    // Certificate / Certifikat
    certificate: [
        'certifikat',
        'uvjerenje',
        'certificate',
        'diploma',
        'potvrda',
        'svjedodžba',
        'svjedodzba',
    ],

    // Report / Izvještaj
    report: [
        'izvještaj',
        'izvjestaj',
        'izvješće',
        'izvjesce',
        'report',
        'analiza',
        'analysis',
    ],

    // Warranty / Jamstvo
    warranty: ['jamstvo', 'garancija', 'warranty', 'guarantee'],

    // Other common categories
    lease: ['najam', 'zakup', 'lease', 'rent', 'renta'],
    loan: ['kredit', 'zajam', 'loan', 'mortgage', 'hipoteka'],
    order: ['narudžba', 'narudzba', 'order', 'ponuda', 'offer'],
    delivery: ['dostava', 'delivery', 'shipping', 'transport'],
};

/**
 * Normalize filename for matching
 * Removes special characters, numbers, and converts to lowercase
 */
function normalizeFileName(fileName: string): string {
    // Remove file extension
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

    // Convert to lowercase and remove special characters
    return nameWithoutExt
        .toLowerCase()
        .replace(/[_-]/g, ' ')
        .replace(/[0-9]/g, '')
        .trim();
}

/**
 * Calculate match score for a pattern against filename
 */
function calculateMatchScore(
    normalizedFileName: string,
    pattern: string,
): number {
    const words = normalizedFileName.split(/\s+/);

    // Exact match in filename
    if (normalizedFileName.includes(pattern)) {
        // Full word match gets highest score
        if (words.includes(pattern)) {
            return 1.0;
        }
        // Partial match gets medium score
        return 0.7;
    }

    // Check if any word starts with the pattern (prefix match)
    for (const word of words) {
        if (word.startsWith(pattern) && pattern.length >= 3) {
            return 0.5;
        }
    }

    return 0;
}

/**
 * Find the best matching category for a filename
 */
function findBestCategory(fileName: string): {
    category: string;
    score: number;
    matchedPattern: string;
} | null {
    const normalized = normalizeFileName(fileName);
    let bestMatch: {
        category: string;
        score: number;
        matchedPattern: string;
    } | null = null;

    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
        for (const pattern of patterns) {
            const score = calculateMatchScore(normalized, pattern);

            if (score > 0 && (!bestMatch || score > bestMatch.score)) {
                bestMatch = {
                    category,
                    score,
                    matchedPattern: pattern,
                };
            }
        }
    }

    return bestMatch;
}

/**
 * Find a matching document type from user's types based on category
 */
function findMatchingDocumentType(
    category: string,
    userDocumentTypes: DocumentType[],
): DocumentType | null {
    // Try exact match first (case-insensitive)
    const exactMatch = userDocumentTypes.find(
        (dt) => dt.name.toLowerCase() === category.toLowerCase(),
    );
    if (exactMatch) return exactMatch;

    // Try matching against category patterns
    const categoryPatterns = CATEGORY_PATTERNS[category] || [];

    for (const docType of userDocumentTypes) {
        const docTypeName = docType.name.toLowerCase();

        // Check if document type name matches any pattern in the category
        for (const pattern of categoryPatterns) {
            if (
                docTypeName.includes(pattern) ||
                pattern.includes(docTypeName)
            ) {
                return docType;
            }
        }
    }

    return null;
}

/**
 * Automatically categorize a document based on its filename
 *
 * @param fileName - The name of the file to categorize
 * @param userDocumentTypes - The user's existing document types
 * @returns Categorization result with document type ID (if found) and confidence level
 */
export function categorizeDocument(
    fileName: string,
    userDocumentTypes: DocumentType[],
): CategorizationResult {
    // Find the best matching category
    const categoryMatch = findBestCategory(fileName);

    if (!categoryMatch) {
        return {
            documentTypeId: null,
            confidence: 'low',
        };
    }

    // Try to find a matching document type from user's types
    const documentType = findMatchingDocumentType(
        categoryMatch.category,
        userDocumentTypes,
    );

    if (documentType) {
        // Determine confidence based on match score
        let confidence: 'high' | 'medium' | 'low';
        if (categoryMatch.score >= 0.9) {
            confidence = 'high';
        } else if (categoryMatch.score >= 0.6) {
            confidence = 'medium';
        } else {
            confidence = 'low';
        }

        return {
            documentTypeId: documentType.id,
            confidence,
            matchedPattern: categoryMatch.matchedPattern,
        };
    }

    // No matching document type found, but we have a category suggestion
    return {
        documentTypeId: null,
        confidence: 'medium',
        matchedPattern: categoryMatch.matchedPattern,
        suggestedTypeName: categoryMatch.category,
    };
}
