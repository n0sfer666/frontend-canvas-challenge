import recessOrder from 'stylelint-config-recess-order';

const classPattern = '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(_[a-z0-9]+(-[a-z0-9]+)*){0,2}$';
const namePattern = '^(?:[a-z]+(?:-[a-z]+)*|[a-z]+(?:[A-Z][a-z]*)*)$';

export default {
  extends: ['stylelint-config-standard', 'stylelint-config-recess-order'],
  rules: {
    'order/properties-order': [recessOrder.rules['order/properties-order'], { severity: 'warning' }],
    'declaration-no-important': [true, { severity: 'warning' }],
    'max-nesting-depth': [3, { severity: 'warning', ignoreAtRules: ['media', 'supports'] }],
    'color-function-notation': ['modern', { severity: 'warning' }],
    'color-function-alias-notation': ['without-alpha', { severity: 'warning' }],
    'alpha-value-notation': ['percentage', { severity: 'warning' }],
    'hue-degree-notation': ['angle', { severity: 'warning' }],
    'lightness-notation': ['percentage', { severity: 'warning' }],
    'import-notation': null,
    'property-no-vendor-prefix': null,
    'value-no-vendor-prefix': null,
    'no-descending-specificity': null,
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global', 'local'] }],
    'keyframes-name-pattern': [namePattern, { severity: 'warning' }],
    'selector-class-pattern': [classPattern, { severity: 'warning', resolveNestedSelectors: true }],
  },
};
