import { chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface PersistedAccount {
  email: string;
  authCode: string;
}

export async function writeAccountConfig(file: string, account: PersistedAccount): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tempFile = `${file}.tmp-${process.pid}`;
  await writeFile(tempFile, JSON.stringify(account, null, 2), { encoding: 'utf8', mode: 0o600 });
  await chmod(tempFile, 0o600).catch(() => undefined);
  await rename(tempFile, file);
  await chmod(file, 0o600).catch(() => undefined);
}
