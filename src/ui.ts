/**
 *
 * This module is special because it usees custom elements
 * and when you try registering them outside of content script you will get an error
 */

// export {
//   createUI,
//   AutogramRoot as UIAutogramRoot,
//   SigningMethod as UISigningMethod,
// } from "./injected-ui/index";
export { FullClient } from "./main";
