// Country data with ISO 3166-1 alpha-2 codes, emoji flags, and groupings by economic union and continent

export type Country = {
    code: string; // ISO 3166-1 alpha-2
    name: string;
    flag: string; // Emoji flag
};

export type CountryGroup = {
    label: string;
    flag?: string; // Economic union flag (e.g. EU flag)
    countries: Country[];
};

// Helper to convert ISO alpha-2 code to emoji flag
const toFlag = (code: string): string => {
    const codePoints = code
        .toUpperCase()
        .split('')
        .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
    return String.fromCodePoint(...codePoints);
};

// EU flag emoji
const EU_FLAG = '🇪🇺';

// Countries organized by economic/continental grouping
export const countryGroups: CountryGroup[] = [
    {
        label: 'European Union',
        flag: EU_FLAG,
        countries: [
            { code: 'AT', name: 'Austria', flag: toFlag('AT') },
            { code: 'BE', name: 'Belgium', flag: toFlag('BE') },
            { code: 'BG', name: 'Bulgaria', flag: toFlag('BG') },
            { code: 'HR', name: 'Croatia', flag: toFlag('HR') },
            { code: 'CY', name: 'Cyprus', flag: toFlag('CY') },
            { code: 'CZ', name: 'Czechia', flag: toFlag('CZ') },
            { code: 'DK', name: 'Denmark', flag: toFlag('DK') },
            { code: 'EE', name: 'Estonia', flag: toFlag('EE') },
            { code: 'FI', name: 'Finland', flag: toFlag('FI') },
            { code: 'FR', name: 'France', flag: toFlag('FR') },
            { code: 'DE', name: 'Germany', flag: toFlag('DE') },
            { code: 'GR', name: 'Greece', flag: toFlag('GR') },
            { code: 'HU', name: 'Hungary', flag: toFlag('HU') },
            { code: 'IE', name: 'Ireland', flag: toFlag('IE') },
            { code: 'IT', name: 'Italy', flag: toFlag('IT') },
            { code: 'LV', name: 'Latvia', flag: toFlag('LV') },
            { code: 'LT', name: 'Lithuania', flag: toFlag('LT') },
            { code: 'LU', name: 'Luxembourg', flag: toFlag('LU') },
            { code: 'MT', name: 'Malta', flag: toFlag('MT') },
            { code: 'NL', name: 'Netherlands', flag: toFlag('NL') },
            { code: 'PL', name: 'Poland', flag: toFlag('PL') },
            { code: 'PT', name: 'Portugal', flag: toFlag('PT') },
            { code: 'RO', name: 'Romania', flag: toFlag('RO') },
            { code: 'SK', name: 'Slovakia', flag: toFlag('SK') },
            { code: 'SI', name: 'Slovenia', flag: toFlag('SI') },
            { code: 'ES', name: 'Spain', flag: toFlag('ES') },
            { code: 'SE', name: 'Sweden', flag: toFlag('SE') },
        ],
    },
    {
        label: 'Europe (non-EU)',
        countries: [
            { code: 'AL', name: 'Albania', flag: toFlag('AL') },
            { code: 'BA', name: 'Bosnia and Herzegovina', flag: toFlag('BA') },
            { code: 'CH', name: 'Switzerland', flag: toFlag('CH') },
            { code: 'GB', name: 'United Kingdom', flag: toFlag('GB') },
            { code: 'IS', name: 'Iceland', flag: toFlag('IS') },
            { code: 'ME', name: 'Montenegro', flag: toFlag('ME') },
            { code: 'MK', name: 'North Macedonia', flag: toFlag('MK') },
            { code: 'NO', name: 'Norway', flag: toFlag('NO') },
            { code: 'RS', name: 'Serbia', flag: toFlag('RS') },
            { code: 'TR', name: 'Turkey', flag: toFlag('TR') },
            { code: 'UA', name: 'Ukraine', flag: toFlag('UA') },
        ],
    },
    {
        label: 'North America',
        countries: [
            { code: 'CA', name: 'Canada', flag: toFlag('CA') },
            { code: 'MX', name: 'Mexico', flag: toFlag('MX') },
            { code: 'US', name: 'United States', flag: toFlag('US') },
        ],
    },
    {
        label: 'Asia',
        countries: [
            { code: 'CN', name: 'China', flag: toFlag('CN') },
            { code: 'IN', name: 'India', flag: toFlag('IN') },
            { code: 'JP', name: 'Japan', flag: toFlag('JP') },
            { code: 'KR', name: 'South Korea', flag: toFlag('KR') },
            { code: 'SG', name: 'Singapore', flag: toFlag('SG') },
            { code: 'AE', name: 'United Arab Emirates', flag: toFlag('AE') },
        ],
    },
    {
        label: 'Oceania',
        countries: [
            { code: 'AU', name: 'Australia', flag: toFlag('AU') },
            { code: 'NZ', name: 'New Zealand', flag: toFlag('NZ') },
        ],
    },
    {
        label: 'South America',
        countries: [
            { code: 'AR', name: 'Argentina', flag: toFlag('AR') },
            { code: 'BR', name: 'Brazil', flag: toFlag('BR') },
            { code: 'CL', name: 'Chile', flag: toFlag('CL') },
        ],
    },
    {
        label: 'Africa',
        countries: [
            { code: 'EG', name: 'Egypt', flag: toFlag('EG') },
            { code: 'NG', name: 'Nigeria', flag: toFlag('NG') },
            { code: 'ZA', name: 'South Africa', flag: toFlag('ZA') },
        ],
    },
];

// Flat list of all countries for lookups
export const allCountries: Country[] = countryGroups.flatMap(
    (group) => group.countries,
);

// Lookup a country by its ISO code
export const getCountryByCode = (code: string): Country | undefined =>
    allCountries.find((c) => c.code === code);

// Get the group a country belongs to
export const getCountryGroup = (code: string): CountryGroup | undefined =>
    countryGroups.find((group) => group.countries.some((c) => c.code === code));
