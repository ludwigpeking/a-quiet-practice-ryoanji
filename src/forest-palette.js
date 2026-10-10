// Display-color families selected from the photo crops and botanical references
// documented in references/README.md. Lighting is applied separately in linear RGB.
export const forestPalettes = {
  cedar: {
    spring: ['#373a26', '#575b43', '#354631', '#48513b'],
    summer: ['#163f22', '#2b5f3c', '#3e4c32', '#27523d'],
    autumn: ['#343a29', '#3e4c32', '#4e543a', '#5b6644'],
    winter: ['#2a2c20', '#3c3127', '#544c44', '#322920'],
  },
  pine: {
    spring: ['#425334', '#596544', '#385137', '#66744e'],
    summer: ['#23462c', '#36563b', '#2b5f3c', '#3e593c'],
    autumn: ['#3b4730', '#4a543a', '#344731', '#566042'],
    winter: ['#2e3629', '#3c4133', '#344239', '#48513b'],
  },
  broadleaf: {
    spring: ['#625937', '#756b44', '#667340', '#7d8648'],
    summer: ['#1c6522', '#3b853e', '#2b5f3c', '#3e4c32'],
    autumn: ['#4a5932', '#62683b', '#33472e', '#73713d'],
    winter: ['#414a35', '#4a493b', '#383e31', '#665443'],
  },
  understory: {
    spring: ['#756b44', '#98906d', '#758345', '#736549'],
    summer: ['#416c32', '#507d39', '#355c34', '#729747'],
    autumn: ['#856033', '#99753c', '#ab5321', '#8d5623'],
    winter: ['#302c23', '#433e35', '#625849', '#4b4537'],
  },
  maple: {
    spring: ['#625937', '#827253', '#899453', '#736549'],
    summer: ['#1c6522', '#3b853e', '#75b56b', '#496f35'],
    autumn: ['#82242d', '#bc3629', '#ab5321', '#d5830c'],
    winter: ['#433e35', '#625849', '#4b4537', '#736957'],
  },
  cherry: {
    spring: ['#967f81', '#b39b9e', '#c9b2b5', '#dfc9cb'],
    summer: ['#486a39', '#5d7d43', '#426033', '#728950'],
    autumn: ['#875831', '#a66c35', '#ae803e', '#785b35'],
    winter: ['#433e35', '#625849', '#4b4537', '#736957'],
  },
};

export function isDeciduousFamily(family) { return ['maple', 'cherry', 'understory'].includes(family); }

export function seasonalLeafRetention(family, season) {
  if (!isDeciduousFamily(family)) return 1;
  if (season === 'winter') return 0;
  if (season === 'spring') return family === 'cherry' ? .86 : .58;
  return 1;
}
