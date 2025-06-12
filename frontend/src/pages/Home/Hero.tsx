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
          minHeight={["auto", "80vh"]}
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
              {/* For Desktop */}
              <Typography
                variant="h2"
                fontWeight={600}
                fontSize={ ["28px", "48px", "60px"]}
                maxWidth={["286px", "928px"]}
                lineHeight={1.5}
                sx={{
                  mt: ["82px","120px"],
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
              sx={{ mt: ['20px','24px' ]}}

           
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
                fontSize={["20px", "38px"]}
              >
                <Typical
                  steps={[
                    " website content",
                    2000,
                    "documents",
                    2000,
                    "videos",
                    2000,
                    "and more",
                    2000,
                  ]}
                  loop={Infinity}
                  wrapper="span"
                />
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              size="large"
              href="/signup"
              sx={{
                mt:["40px","70px"],
                mb: "60px",
              
                fontSize: ["16px", "18px"],
                fontWeight: 500,
                borderRadius: "40px",
                height: ["52px","62px"],
                minWidth: ["210px","220px"],
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
