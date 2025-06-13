import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
} from "@mui/material";
import React from "react";

export default function Top() {
  return (
    <Box
      display={"flex"}
      flexDirection={"column"}
      justifyContent={"center"}
      alignItems={"center"}
      gap={2}
      color={"#fff"}
      px={2}
      pt={2.5}
      pb={5}
      sx={{ backgroundColor: "#101035" }}
    >
      <Container maxWidth="lg">
        <Box
          px={[1, 10]}
          pt={[2,10]}
          pb={[2,14]}
          sx={{
            backgroundImage: "url(/images/title-bg.png)",
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <Typography
            variant="h2"
            fontWeight={600}
            fontSize={["30px", "60px"]}
            sx={{
              background: "-webkit-linear-gradient(#FFF, #959595)",
              backgroundClip: "text",
              textFillColor: "transparent",
            }}
            textAlign={"center"}
            mb={[4, 0]}
          >
           Our Services
          </Typography>
        </Box>
        {/* <Box >
          <Grid
            container
            rowSpacing={[10, 5]}
            columnSpacing={{ xs: 2, sm: 2, md: 8 }}
          >
            <Grid item md={4} textAlign={["center", "left"]}>
              <StyledImage
                src="/images/icons/icon-thumb.png"
                sx={{
                  width: "74px",
                  height: "74px",
                  margin: ["auto", "unset"],
                }}
              />

              <Typography
                variant="h3"
                fontWeight={600}
                fontSize={["20px", "22px"]}
                mb={2}
                mt={[3, 5]}
                lineHeight={1.4}
                // whiteSpace="nowrap"
                // minWidth={["100%", "none"]}
              >
                Elevate Your Customer Experience
              </Typography>

              <Typography variant="body1" color={"#9F9F9F"}  sx={{
    fontSize: ['14px', '16px'], }}>
                Enhance customer satisfaction with AI-driven assistance that
                ensures quick, accurate, and engaging interactions. 
              </Typography>
            </Grid>

            <Grid item md={4}    textAlign={["center", "left"]}>
              <StyledImage
                src="/images/icons/icon-growth.png"
                sx={{
                  width: "74px",
                  height: "74px",
                  margin: ["auto", "unset"],
                }}
              />

              <Typography
                variant="h3"
                fontWeight={600}
                fontSize={["20px", "22px"]}
                mt={[3, 5]}
                mb={2}
                lineHeight={1.4}
              >
                Accelerated Customer Assistance
              </Typography>

              <Typography variant="body1" color={"#9F9F9F"}  sx={{
    fontSize: ['14px', '16px'], }}>
                Cut support time by 70% with bots that work 24/7, freeing your team for empathetic and  high-impact interactions. 
              </Typography>
            </Grid>

            <Grid item md={4}    textAlign={["center", "left"]}>
              <StyledImage
                src="/images/icons/icon-speed.png"
                sx={{
                  width: "74px",
                  height: "74px",

                  margin: ["auto", "unset"],
                }}
              />

              <Typography
                variant="h3"
                fontWeight={600}
                fontSize={["20px", "22px"]}
                mb={2}
                mt={[3, 5]}
                lineHeight={1.4}
              >
                Designed to Handle Any Demand
              </Typography>

              <Typography variant="body1" color={"#9F9F9F"} sx={{
    fontSize: ['14px', '16px'], }}>
                Maintain consistent performance during traffic spikes, seasonal
                rushes, or growth phases, scaling effortlessly.
              </Typography>
            </Grid>
          </Grid>
        </Box> */}
      </Container>
    </Box>
  );
}

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
