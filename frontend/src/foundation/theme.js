import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#5A6CF2',
      main100: '#00AC94',
      main80: '#11AC96',
      main60: '#56ACA0',
      main40: '#A7ECE2',
      main20: 'rgba(167, 236, 226, 0.3)',
    },
    // tabColor: {
    //     defaultTab: "#00806E",
    //     selectedTab: main100,
    //   },
    secondary: {
      main: '#4B3498',
      main100: '#2E52EB',
      main80: '#6683FF',
      main60: '#99ACFF',
      main40: '#CCD6FF',
    },
    tertiary: {
      main: '#880845',
      main100: '#CA3A7F',
      main80: '#DF89B2',
      main60: '#EAB0CC',
      main40: '#F4D8E5',
    },
    neutral: {
      dark: '#001512',
      dark100: '#001512',
      dark80: '#434B4A',
      dark60: '#76807E',
      dark40: '#95A09E',
      light: '#fff',
      light100: '#FCFCFC',
      light80: '#F0F0F0',
      light60: '#E9E9E9',
      light40: '#D8D8D8',
    },
    accentPrimary: {
      main: '#EB6D00',
      accent100: '#EB6D00',
      accent80: '#EB872F',
      accent60: '#FAB77D',
      accent40: '#FFE4CC',
    },
    accentSecondary: {
      main: '#D00000',
      accent100: '#D03434',
      accent80: '#FF6666',
      accent60: '#FF9999',
      accent40: '#FFCCCC',
    },
    accentTertiary: {
      main: '#287D89',
      accent100: '#009AAF',
      accent80: '#29B8CC',
      accent60: '#66EDFF',
      accent40: '#99F3FF',
    },
  },
  typography: {
    fontFamily: "'Instrument Sans', sans-serif",

    d1: {
      fontSize: 60,
      fontWeight: 600,
    },
    d2: {
      fontSize: 48,
      fontWeight: 600,
    },

    // h1: {
    //   fontSize: 32,
    //   fontWeight: 600,
    // },
    // h2: {
    //   fontSize: 28,
    //   fontWeight: 700,
    // },
    // h3: {
    //   fontSize: 24,
    //   fontWeight: 700,
    // },
    // h4: {
    //   fontSize: 20,
    //   fontWeight: 700,
    // },
    // h5: {
    //   fontSize: 18,
    //   fontWeight: 700,
    // },
    // h6: {
    //   fontSize: 18,
    //   fontWeight: 800,
    // },
    // subtitle1: {
    //   fontSize: 20,
    //   fontWeight: 600,
    // },
    // subtitle2: {
    //   fontSize: 18,
    //   fontWeight: 600,
    // },
    // body1: {
    //   fontSize: 16,
    //   fontWeight: 400,
    // },
    // body2: {
    //   fontSize: 16,
    //   fontWeight: 400,
    // },
    // body2Bold: {
    //   fontSize: 16,
    //   fontWeight: 600,
    // },
    // body3: {
    //   fontSize: 14,
    //   fontWeight: 400,
    // },
    // button: {
    //   fontSize: 14,
    //   fontWeight: 600,
    // },
    // buttonRegular: {
    //   fontSize: 14,
    //   fontWeight: 400,
    // },
    // caption: {
    //   fontSize: 12,
    //   fontWeight: 400,
    // },

    // inherit: {
    //   fontSize: 16,
    //   fontWeight: 400,
    // },
  },
});

export default theme;
