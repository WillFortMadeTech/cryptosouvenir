// Well-known AAGUID → human-readable device name.
// Source: https://github.com/passkeydeveloper/passkey-authenticator-aaguids
const KNOWN: Record<string, string> = {
  // YubiKey
  'cb69481e-8ff7-4039-93ec-0a2729a154a8': 'YubiKey 5',
  '2fc0579f-8113-47ea-b116-bb5a8db9202a': 'YubiKey 5 Nano',
  '73bb0cd4-e502-49b8-9c6f-b59445bf720b': 'YubiKey 5C',
  'a4e9fc6d-4cbe-4758-b8ba-37598bb5bbaa': 'YubiKey 5C NFC',
  'ee882879-721c-4913-9775-3dfcce97072a': 'YubiKey 5 FIPS',
  'c1f9a0bc-1dd2-404a-b27f-8e29047a43fd': 'YubiKey 5 FIPS NFC',
  'f8a011f3-8c0a-4d15-8006-17111f9edc7d': 'Security Key by Yubico',
  '6d44ba9b-f6ec-2e49-b930-0c8fe920cb73': 'Security Key NFC by Yubico',
  '149a2021-8ef6-4133-96b8-81f8d5b7f1f5': 'Security Key by Yubico',
  // Windows Hello
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  'd8522d9f-575b-4866-88a9-ba99fa02f35b': 'Windows Hello',
  // Apple
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain',
  'b84e4048-15dc-4dd0-8640-f4f60813c8af': 'iCloud Keychain',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain',
  // Google
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on macOS',
}

export function resolveDevice(aaguid: string, transports: string[]): string {
  if (KNOWN[aaguid]) return KNOWN[aaguid]
  if (transports.includes('internal')) return 'Platform Authenticator'
  if (transports.includes('usb'))      return 'USB Security Key'
  if (transports.includes('nfc'))      return 'NFC Security Key'
  if (transports.includes('ble'))      return 'Bluetooth Key'
  return 'Hardware Authenticator'
}
