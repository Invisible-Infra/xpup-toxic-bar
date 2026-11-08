declare module 'pngjs' {
  export const PNG: {
    sync: {
      read: (buf: Buffer) => { width: number, height: number }
    }
  }
}

declare module 'jpeg-js' {
  export function decode (buf: Buffer, opts?: { useTArray?: boolean, maxResolutionInMP?: number, maxMemoryUsageInMB?: number }): { width: number, height: number }
}
