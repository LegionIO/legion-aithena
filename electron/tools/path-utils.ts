import { isAbsolute, resolve } from 'path';
import { homedir } from 'os';

export function resolveToolPath(pathValue: string, cwd?: string): string {
  if (isAbsolute(pathValue)) {
    return pathValue;
  }

  return resolve(cwd || homedir(), pathValue);
}
