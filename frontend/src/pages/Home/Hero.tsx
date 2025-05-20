import React from "react";
import { Box, Button, Typography } from "@mui/material";
import Typical from "react-typical";

export default function Hero() {
  return (
    <>
      <Box
        mt={"50px"}
        sx={{
          backgroundImage: "url(/images/dot-bg.png)",
          backgroundPosition: "center",
          backgroundColor: "#101035",
        }}
      >
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          sx={{
            backgroundImage: "url(/images/hero-bg.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
          minHeight={"80vh"}
        >
          <Box
            display={"flex"}
            flexDirection={"column"}
            justifyContent={"center"}
            alignItems={"center"}
            gap={2}
            textAlign={"center"}
            color={"#fff"}
            px={2}
          >
            <>
              {/* For Desktop */}
              <Typography
                variant="h2"
                fontWeight={600}
                fontSize={ ["28px", "48px", "60px"]}
                maxWidth={["286px", "928px"]}
                lineHeight={1.5}
                sx={{
                  mt: "120px",
                  // Only show on medium and above
                  background: "-webkit-linear-gradient(#FFF, #959595)",
                  backgroundClip: "text",
                  textFillColor: "transparent",
                }}
                textAlign="center"
              >
                Build AI Chatbots and Agents on 
                Our Self-Service Platform
              </Typography>

              
            </>

         
            <Box
              display={"flex"}
              flexDirection={{ xs: "column", sm: "row" }}
              flexWrap={"wrap"}
              justifyContent={"center"}
              alignItems={"center"}
              gap={[0.5, 2]}
              sx={{ mt: '24px' }}

           
            >
              <Typography
                variant="body1"
                fontWeight={500}
                fontSize={["20px", "38px"]}
              
                sx={{
                 
                  background: "-webkit-linear-gradient(#FFF, #959595)",
                  backgroundClip: "text",
                  textFillColor: "transparent",
                }}
              >
                Train on your{" "}
              </Typography>

              <Typography
                variant="h3"
                color={"#779BFD"}
                fontWeight={500}
                fontSize={["28px", "38px"]}
              >
                <Typical
                  steps={[
                    "website content",
                    2000,
                    "amazing features",
                    2000,
                    "great design",
                    2000,
                  ]}
                  loop={Infinity}
                  wrapper="span"
                />
              </Typography>
            </Box>
            {/* <Typography variant="h6" color="#B4B4B4" mt={2} mb={3}>
              Build, personalize, and deploy AI-powered chatbots effortlessly
            </Typography> */}
            <Button
              variant="contained"
              color="primary"
              size="large"
              sx={{
                mt:"70px",
                mb: "60px",
              
                fontSize: "18px",
                fontWeight: 500,
                borderRadius: "40px",
                height: "62px",
                minWidth: "220px",
                textTransform: "capitalize",
                background:
                  "linear-gradient(180deg,rgba(90, 108, 242, 1) 0%, rgba(75, 52, 152, 1) 100%);",
              }}
            >
              Get started for free
            </Button>
          </Box>
        </Box>
      </Box>
    </>
  );
}
