import * as React from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import AIPage from "./AIPage";
import PredictiveModelsPage from "./PredictiveModelsPage";
import WorkplaceBotsPage from "./WorkplaceBotsPage";
import ProcessAutomationPage from "./ProcessAutomationPage";
import CustomAISolutionsPage from "./CustomAISolutionPage";

function TabPanel(props: {
  children?: React.ReactNode;
  value: number;
  index: number;
}) {
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
        <Box
          sx={{
            p: 4,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Typography variant="h6" align="center" color="#ffffff">
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
    <Box
      sx={{
        // backgroundImage: "url(/images/title-bg.png)",",
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#070417",
        fontFamily: "instrument sans,sans-serif",
      }}
    >
      <Box
        maxWidth={"1081px"}
        sx={{
          border: "1px solid white",
          backgroundColor:"#070417",
          // background:
          //   "linear-gradient(rgba(189, 204, 231, 0.6), rgba(71, 53, 144, 0.08))",

          background: "linear-gradient(135deg, rgba(7,4,23,0.95), rgba(61,73,213,0.1))",

          backdropFilter: "blur(76.15px)",
          position: "sticky",
          zIndex: 1100,
          top: "65px",
          mx: "auto",
          px: "20px",
          width: "90%",
          borderRadius: "52px",
        }}
      >

        <Tabs
          value={value}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          onChange={handleChange}
          centered
          aria-label="centered tabs example"
          TabIndicatorProps={{ style: { display: "none" } }}
          sx={{
            maxWidth: "980px",
            mx: "auto",
            height: "76px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Tab
            label="AI Agents"
            sx={{
              fontFamily: "instrument sans,sans-serif",
              fontSize: ["14px", "18px"],
              textTransform: "none",
              color: "#CACACA",
              "&.Mui-selected": {
                background:
                  "linear-gradient(135deg, #5939C1, #9480D8, #7D63D3, #6647CA)",
                borderRadius: "42px",
                height: "50px",
                width: "147px",
                color: "#ffffff",
              },
            }}
          />
          <Tab
            label="Predictive Models"
            sx={{
              fontFamily: "instrument sans,sans-serif",
              fontSize: ["14px", "18px"],
              textTransform: "none",
              color: "#CACACA",
              "&.Mui-selected": {
                background:
                  "linear-gradient(135deg, #5939C1, #9480D8, #7D63D3, #6647CA)",
                borderRadius: "42px",
                height: "50px",
                color: "#ffffff",
              },
            }}
          />
          <Tab
            label="Workplace Bots"
            sx={{
              fontFamily: "instrument sans,sans-serif",
              fontSize: ["14px", "18px"],
              textTransform: "none",
              color: "#CACACA",
              "&.Mui-selected": {
                background:
                  "linear-gradient(135deg, #5939C1, #9480D8, #7D63D3, #6647CA)",
                borderRadius: "42px",
                height: "50px",
                color: "#ffffff",
              },
            }}
          />
          <Tab
            label="Process Automation"
            sx={{
              fontFamily: "instrument sans,sans-serif",
              fontSize: ["14px", "18px"],
              textTransform: "none",
              color: "#CACACA",
              "&.Mui-selected": {
                background:
                  "linear-gradient(135deg, #5939C1, #9480D8, #7D63D3, #6647CA)",
                borderRadius: "42px",
                height: "50px",
                color: "#ffffff",
              },
            }}
          />
          <Tab
            label="Custom AI Solutions"
            sx={{
              fontFamily: "instrument sans,sans-serif",
              fontSize: ["14px", "18px"],
              textTransform: "none",
              color: "#CACACA",
              "&.Mui-selected": {
                background:
                  "linear-gradient(135deg, #5939C1, #9480D8, #7D63D3, #6647CA)",
                borderRadius: "42px",
                height: "50px",
                color: "#ffffff",
              },
            }}
          />
        </Tabs>
      </Box>

      <TabPanel value={value} index={0}>
        <AIPage />
      </TabPanel>
      <TabPanel value={value} index={1}>
        <PredictiveModelsPage />
      </TabPanel>
      <TabPanel value={value} index={2}>
        <WorkplaceBotsPage />
      </TabPanel>
      <TabPanel value={value} index={3}>
        <ProcessAutomationPage />
      </TabPanel>
      <TabPanel value={value} index={4}>
        <CustomAISolutionsPage />
      </TabPanel>
    </Box>
  );
}
