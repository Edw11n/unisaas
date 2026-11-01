export type EscPosProfile = '58mm' | '80mm';

export interface EscPosTicketOptions {
  profile: EscPosProfile;
  lines: string[];
  openDrawer?: boolean;
  cutPaper?: boolean;
  feedLines?: number;
}

export interface EscPosTicketResult {
  buffer: Buffer;
  contentType: 'application/octet-stream';
  byteLength: number;
  encoding: 'base64';
  data: string;
}

