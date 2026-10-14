export const english = {
  appName: 'AutoAI India', findCar: 'Find your car', compare: 'Compare', configure: 'Configure',
  inventory: 'Available inventory', booking: 'Booking', estimate: 'Estimate',
  verified: 'Verified source', verificationPending: 'Verification pending',
  noVerifiedInventory: 'No verified inventory available',
  priceDisclaimer: 'Ex-showroom price. Taxes, insurance and fees are extra.',
  translationFallback: 'This content is shown in English while translation is awaiting review.',
} as const;
export type TranslationKey = keyof typeof english;
const hindi: Record<TranslationKey, string> = {
  appName: 'ऑटोएआई इंडिया', findCar: 'अपनी कार खोजें', compare: 'तुलना करें', configure: 'कार कॉन्फ़िगर करें',
  inventory: 'उपलब्ध वाहन', booking: 'बुकिंग', estimate: 'अनुमान', verified: 'सत्यापित स्रोत',
  verificationPending: 'सत्यापन बाकी है', noVerifiedInventory: 'कोई सत्यापित वाहन उपलब्ध नहीं है',
  priceDisclaimer: 'एक्स-शोरूम कीमत। कर, बीमा और शुल्क अतिरिक्त हैं।',
  translationFallback: 'अनुवाद की समीक्षा होने तक यह सामग्री अंग्रेज़ी में दिखाई गई है।',
};
/** All 22 Eighth Schedule languages plus English. Coverage does not imply reviewed translations. */
export const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'کٲشُر' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mni', name: 'Manipuri', nativeName: 'মৈতৈলোন্' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
] as const;
export type LanguageCode = typeof languages[number]['code'];
export function translate(key: TranslationKey, language: string) {
  const supported = languages.some(l => l.code === language);
  const hasDictionary = language === 'en' || language === 'hi';
  return {
    text: language === 'hi' ? hindi[key] : english[key],
    requestedLanguage: language, resolvedLanguage: language === 'hi' ? 'hi' : 'en',
    fallback: !hasDictionary, supported,
    reviewStatus: language === 'en' ? 'source' : 'awaiting-native-review',
    direction: (['ks', 'sd', 'ur'].includes(language) && hasDictionary ? 'rtl' : 'ltr') as 'ltr' | 'rtl',
  };
}
