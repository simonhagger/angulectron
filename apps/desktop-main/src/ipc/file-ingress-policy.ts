import { promises as fs } from 'node:fs';
import path from 'node:path';

type FileSignatureRule = {
  magic: Buffer;
  offset: number;
};

type FileIngressPolicy = {
  allowedExtensions: string[];
  signature?: FileSignatureRule;
};

const FILE_INGRESS_POLICIES: Record<string, FileIngressPolicy> = {
  textRead: {
    allowedExtensions: ['.txt', '.md', '.json', '.log'],
  },
  pdfInspect: {
    allowedExtensions: ['.pdf'],
    signature: {
      magic: Buffer.from('%PDF-', 'ascii'),
      offset: 0,
    },
  },
};

export type FileIngressPolicyName = keyof typeof FILE_INGRESS_POLICIES;

export type FileIngressPolicyResult =
  | {
      kind: 'ok';
      fileName: string;
    }
  | {
      kind: 'unsupported-extension';
      fileName: string;
      extension: string;
      allowedExtensions: readonly string[];
    }
  | {
      kind: 'signature-mismatch';
      fileName: string;
      headerHex: string;
      expectedHex: string;
    };

const readSignatureWindowHex = async (
  filePath: string,
  offset: number,
  length: number,
) => {
  const file = await fs.open(filePath, 'r');
  try {
    const header = Buffer.alloc(length);
    const readResult = await file.read(header, 0, header.length, offset);
    return header.subarray(0, readResult.bytesRead).toString('hex');
  } finally {
    await file.close();
  }
};

export const evaluateFileIngressPolicy = async (
  filePath: string,
  policyName: FileIngressPolicyName,
): Promise<FileIngressPolicyResult> => {
  const policy = FILE_INGRESS_POLICIES[policyName];
  const fileName = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();

  if (!policy.allowedExtensions.includes(extension)) {
    return {
      kind: 'unsupported-extension',
      fileName,
      extension,
      allowedExtensions: policy.allowedExtensions,
    };
  }

  if (!policy.signature) {
    return { kind: 'ok', fileName };
  }

  const expectedHex = policy.signature.magic.toString('hex');
  const headerHex = await readSignatureWindowHex(
    filePath,
    policy.signature.offset,
    policy.signature.magic.length,
  );
  if (headerHex !== expectedHex) {
    return {
      kind: 'signature-mismatch',
      fileName,
      headerHex,
      expectedHex,
    };
  }

  return { kind: 'ok', fileName };
};
