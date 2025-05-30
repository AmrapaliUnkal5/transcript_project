import React from "react";
import { Box, Button, Typography } from "@mui/material";
import Typical from "react-typical";

export default function Hero() {
  return (
    <>
      <Box
        mt={"50px"}

        sx={{
          // backgroundImage: "url(/images/dot-bg.png)",
          backgroundPosition: "center",
          //backgroundColor: "#101035",
        }}
      >
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          sx={{
            //  backgroundImage: "url(/images/hero-bg.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            minHeight: {
              xs: "auto", // for extra-small screens (phones), no minHeight
              md: "65vh", // from medium screens and up, minHeight is 80vh
            },
          }}
        >
          <Box
            display={"flex"}
            flexDirection={"column"}
            justifyContent={"center"}
            alignItems={"center"}
            textAlign={"center"}
            color={"#fff"}
            px={2}
          >
            <>
              <Typography
                variant="h2"
                fontWeight={600}
                fontSize={["28px", "48px", "60px"]}
                maxWidth={["286px", "930px"]}
                lineHeight={1.1}
                sx={{
                  mt: "45px",

                  background: "-webkit-linear-gradient(#FFF, #959595)",
                  backgroundClip: "text",
                  textFillColor: "transparent",
                }}
                textAlign="center"
              >
                The Right Plan For Every Organization
              </Typography>
            </>

            <Box
              display={"flex"}
              flexDirection={{ xs: "column", sm: "row" }}
              flexWrap={"wrap"}
              justifyContent={"center"}
              alignItems={"center"}
              gap={[0.5, 2]}
              sx={{ mt: ["22px", "27px"] }}
            >
              <Typography
                variant="body1"
                fontWeight={400}
                fontSize={["16px", "20px"]}
                sx={{
                  background: "-webkit-linear-gradient(#FFF, #959595)",
                  backgroundClip: "text",
                  textFillColor: "transparent",
                }}
              >
                Build your AI Agents effortlessly. Try 30 days risk-free
              </Typography>
            </Box>
            {/* <Typography variant="h6" color="#B4B4B4" mt={2} mb={3}>
              Build, personalize, and deploy AI-powered chatbots effortlessly
            </Typography> */}
          </Box>
        </Box>
      </Box>
    </>
  );
}
