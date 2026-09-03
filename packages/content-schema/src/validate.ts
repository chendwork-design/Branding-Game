import { validateContent } from './index.js';
import { fullContent } from './full.js';

validateContent(fullContent);
console.log(`content valid: ${fullContent.contentVersion}`);
