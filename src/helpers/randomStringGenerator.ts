const baseNumbers = '0123456789';
const baseSpecialAlphaNumbers = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function randomStringGenerator (length: number, useAnySymbols: boolean = false): string {
  let password = '';
  const base: string = useAnySymbols ? baseSpecialAlphaNumbers : baseNumbers;
  for ( let i = 0; i <= length - 1; i = i + 1 ) {
    password += base.charAt( Math.floor( Math.random() * base.length ) );
  }
  return password;
}
