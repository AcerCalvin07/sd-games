import { MAX_HINT_LEN, MAX_PLAYER_NAME, ROOM_CODE_ALPHABET, ROOM_CODE_LEN } from './constants';

const NAME_REGEX = /^[a-zA-Z0-9 ]+$/;
const HINT_REGEX = /^[a-zA-Z0-9 ]+$/;

export function isValidPlayerName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= MAX_PLAYER_NAME && NAME_REGEX.test(trimmed);
}

export function isValidHint(hint: string): boolean {
  const trimmed = hint.trim();
  return trimmed.length >= 1 && trimmed.length <= MAX_HINT_LEN && HINT_REGEX.test(trimmed);
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().slice(0, ROOM_CODE_LEN);
}

export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    out += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return out;
}
