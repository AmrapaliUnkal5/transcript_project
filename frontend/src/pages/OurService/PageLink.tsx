import * as React from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';

function TabPanel(props: { children?: React.ReactNode; value: number; index: number }) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Typography variant="h6" align="center">
            {children}
          </Typography>
        </Box>
      )}
    </div>
  );
}

export default function BasicTabs() {
  const [value, setValue] = React.useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: '100%', textAlign: 'center' }}>
      <Tabs
        value={value}
        onChange={handleChange}
        centered
        aria-label="centered tabs example"
      >
        <Tab label="Home" />
        <Tab label="About" />
        <Tab label="Services" />
        <Tab label="Portfolio" />
        <Tab label="Contact" />
      </Tabs>

      <TabPanel value={value} index={0}>
        Welcome to the Home page. Here is some introductory content.
      </TabPanel>
      <TabPanel value={value} index={1}>
        Learn more About us and what we stand for.
      </TabPanel>
      <TabPanel value={value} index={2}>
        Our Services include web design, development, and consulting.
      </TabPanel>
      <TabPanel value={value} index={3}>
        Check out our Portfolio of previous projects and case studies.
      </TabPanel>
      <TabPanel value={value} index={4}>
        Contact us at contact@example.com or through our social channels.
      </TabPanel>

      <Tabs
        value={value}
        onChange={handleChange}
        centered
        aria-label="centered tabs example"
      >
        <Tab label="Home" />
        <Tab label="About" />
        <Tab label="Services" />
        <Tab label="Portfolio" />
        <Tab label="Contact" />
      </Tabs>
    </Box>
  );
}
