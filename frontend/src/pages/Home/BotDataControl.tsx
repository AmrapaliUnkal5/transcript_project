import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
} from "@mui/material";
import React from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export default function BotDataControl() {
  return (
    <>
      <Box
        display={"flex"}
        flexDirection={"column"}
        justifyContent={"center"}
        alignItems={"center"}
        gap={2}
        color={"#fff"}
        px={2}
        py={5}
        sx={{ backgroundColor: "#101035" }}
      >
        <Container maxWidth="lg">
          <Box
            px={[1, 10]}
            py={[2, 10]}
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
              fontSize={["32px", "52px"]}
              sx={{
                background: "-webkit-linear-gradient(#FFF, #959595)",
                backgroundClip: "text",
                textFillColor: "transparent",
              }}
              textAlign={"center"}
            >
              Your Data. Your Bots. Your New AI Era.
            </Typography>
          </Box>

          <Box>
            <Grid
              container
              rowSpacing={3}
              columnSpacing={{ xs: 2, sm: 2, md: 3 }}
            >
              <Grid item sm={6}>
                <Box
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",

                    px: 2, 
                  }}
                >
                  <Typography
                    variant="h3"
                    fontWeight={600}
                    fontFamily={"'Instrument Sans', sans-serif"}
                    fontSize={["18px", "30px"]}
                    mb={2}
                  >
                    Build Intelligent Bots in Minutes
                  </Typography>
                  <Typography
                    variant="body1"
                    color={"#cacaca"}
                    fontFamily={"'Instrument Sans', sans-serif"}
                    fontSize={18}
                    fontWeight={400}
                  >
                    Our platform empowers you to build sophisticated AI bots
                    trained directly on your website content, PDF, DOCX, TXT,
                    knowledge articles, YouTube videos and more. While we handle
                    the complex Al processes behind the scenes, you’re free to
                    focus on customizing your bots.
                  </Typography>
                </Box>
              </Grid>
              <Grid item sm={6}>
                <StyledImage
                  src="/images/dummy/Hero_Section.png"
                  sx={{ margin: "auto", width: 438, height: 323 }}
                />
              </Grid>
            </Grid>
          </Box>
          {/* <Box display={"flex"} justifyContent={"center"} my={2}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              href="/login"
              sx={{
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
          </Box> */}
        </Container>
      </Box>
    </>
  );
}

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
