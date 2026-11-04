export const MAX_TTF_FILE_SIZE = 10 * 1024 * 1024;

const TTF_SIGNATURES = [
  [0x00, 0x01, 0x00, 0x00],
  [0x74, 0x72, 0x75, 0x65],
  [0x74, 0x79, 0x70, 0x31],
];

export function isSupportedTtf(
  fileName: string,
  fileSize: number,
  signature: Uint8Array,
): boolean {
  if (
    !fileName.toLowerCase().endsWith(".ttf") ||
    fileSize < 4 ||
    fileSize > MAX_TTF_FILE_SIZE ||
    signature.length < 4
  ) {
    return false;
  }

  return TTF_SIGNATURES.some((expected) =>
    expected.every((byte, index) => signature[index] === byte),
  );
}
