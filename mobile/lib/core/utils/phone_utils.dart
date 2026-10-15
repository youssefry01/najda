/// بيحوّل رقم موبايل مصري لـ 10 أرقام (من غير 0 ولا +20)،
/// أو null لو مش صحيح. مثال: 01012345678 أو 1012345678 ← 1012345678
String? normalizeEgyptianMobile(String input) {
  var digits = input.replaceAll(RegExp(r'\D'), '');
  if (digits.startsWith('20') && digits.length == 12) {
    digits = digits.substring(2);
  }
  if (digits.startsWith('0')) digits = digits.substring(1);
  return RegExp(r'^1[0125]\d{8}$').hasMatch(digits) ? digits : null;
}

/// الصيغة الدولية (E.164). افتراض مؤقت لحد ما نتأكد من صيغة الـ Backend.
String toEgyptE164(String tenDigits) => '+20$tenDigits';
