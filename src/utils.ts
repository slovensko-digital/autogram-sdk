/**
 *
 * @returns true if the browser is Safari (heuristic based on navigator.userAgent)
 */
export function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}


export function isMacOS(): boolean {
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}