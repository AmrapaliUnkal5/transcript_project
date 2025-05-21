import React from "react";
import { Box, Button, Typography } from "@mui/material";
import Typical from "react-typical";

export default function CustomizeExperience() {
  return (
    <>
      <Box
        sx={{
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
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <Box
            display={"flex"}
            flexDirection={"column"}
            justifyContent={"center"}
            alignItems={"center"}
            textAlign={"center"}
            color={"#fff"}
          >
            <>
             
              <Typography
                variant="h2"
                fontWeight={600}
                fontSize={["30px", "48px", "54px"]}
                maxWidth={["286px", "930px"]}
                lineHeight={["44px", "75px", "75px"]}
                mt={["74px","148px"]}
               
                sx={{
                  background:
                    "linear-gradient(90deg, #FFFFFF 0%, #959595 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
                textAlign="center"
              >
                Customize Your Experience with Powerful Add-Ons
              </Typography>
            </>

            <Box
              display={"flex"}
              flexDirection={{ xs: "column", sm: "row" }}
              flexWrap={"wrap"}
              justifyContent={"center"}
              alignItems={"center"}
              sx={{ mt: ["27px", "47px"] }}
              
            >
              <Typography
                variant="body1"
                fontWeight={400}
                fontSize={["16px", "20px"]}
                lineHeight={["26px", "32px"]}
                sx={{
                  background: "-webkit-linear-gradient(#FFF)",
                  backgroundClip: "text",
                  textFillColor: "transparent",
                  maxWidth: ["286px", "818px"],
                }}
              >
                Add specialized features to any paid plan—no full upgrade
                needed. Customize your AI solution to fit your goals.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}
