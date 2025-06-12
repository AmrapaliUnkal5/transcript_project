import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
} from "@mui/material";
import React from "react";

export default function FourStage() {
  return (
    <Box
      display={"flex"}
      flexDirection={"column"}
      justifyContent={"center"}
      alignItems={"center"}
      gap={2}
      color={"#fff"}
      px={2}
      pb={5}
      sx={{ backgroundColor: "#101035" }}
    >
      <Container maxWidth="lg">
        <Box
          px={[1, 10]}
          pt={[2, 10]}
          pb={[2, 14]}
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
            fontSize={["20px", "30px"]}
            sx={{
              background: "-webkit-linear-gradient(#FFF, #959595)",
              backgroundClip: "text",
              textFillColor: "transparent",
            }}
            textAlign={"center"}
            mb={[4, 0]}
          >
            4 Simple Steps to Your Custom Agent
          </Typography>
        </Box>
        <Box
          display={"flex"}
          alignItems={"center"}
          justifyContent={{ xs: "center", sm: "space-between" }}
          flexWrap={"wrap"}
          gap={[4,4]}
        >
          <Box textAlign={"center"}>
            <Box
              sx={{
                
                background: "linear-gradient(180deg, #3A3A3A 0%, #170E3B 100%)",
                borderRadius: "30px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: 194,
                height: 180,
              }}
            >
              <StyledImage
                src="/images/dummy/LoadData.png"
                sx={{
                  width: "104px",
                  height: "104px",
                }}
              />
            </Box>

            <Typography
              variant="h3"
              fontWeight={400}
              fontSize={["20px", "20px"]}
              lineHeight={1.4}
              mt={1}
            >
              Load Your Data
            </Typography>
          </Box>
          <Box display={["none", "none","none","block"]}>
            {" "}
            <Box
              component="img"
              src="/images/dummy/Union.png"
              alt="Arrow"
              sx={{
                display: { xs: "none", md: "block" },

                transform: "translateY(-50%)",
                height: "40px",
              }}
            />
          </Box>

          <Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <Box
                sx={{
                  background:
                    "linear-gradient(180deg, #3A3A3A 0%, #170E3B 100%)",
                  borderRadius: "30px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: 194,
                  height: 180,
                  mb: 2,
                }}
              >
                <StyledImage
                  src="/images/dummy/DesignYour.png"
                  sx={{
                    width: "104px",
                    height: "104px",
                  }}
                />
              </Box>

              <Typography
                variant="h3"
                fontWeight={400}
                fontSize={["20px", "20px"]}
                lineHeight={1.4}
              >
                Design Your Experience
              </Typography>
            </Box>
          </Box>

          <Box display={["none", "none","none","block"]}>
            {" "}
            <Box

              component="img"
              src="/images/dummy/Union.png"
              alt="Arrow"
              sx={{
                display: { xs: "none", md: "block" },

                transform: "translateY(-50%)",
                height: "40px",
              }}
            />
          </Box>

          <Box textAlign={"center"}>
            <Box
              sx={{
                background: "linear-gradient(180deg, #3A3A3A 0%, #170E3B 100%)",
                borderRadius: "30px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: 194,
                height: 180,
                mb: 2,
              }}
            >
              <StyledImage
                src="/images/dummy/BuildYour.png"
                sx={{
                  width: "104px",
                  height: "104px",
                }}
              />
            </Box>

            <Typography
              variant="h3"
              fontWeight={400}
              fontSize={["20px", "20px"]}
              lineHeight={1.4}
            >
              Build your Bot
            </Typography>
          </Box>
          <Box display={["none", "none","none","block"]}>
            {" "}
            <Box
              component="img"
              src="/images/dummy/Union.png"
              alt="Arrow"
              sx={{
                display: { xs: "none", md: "block" },

                transform: "translateY(-50%)",
                height: "40px",
              }}
            />
          </Box>
          <Box>
            {" "}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <Box
                sx={{
                  background:
                    "linear-gradient(180deg, #3A3A3A 0%, #170E3B 100%)",
                  borderRadius: "30px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: 194,
                  height: 180,
                  mb: 2,
                }}
              >
                <StyledImage
                  src="/images/dummy/Deploy.png"
                  sx={{
                    width: "104px",
                    height: "104px",
                  }}
                />
              </Box>

              <Typography
                variant="h3"
                fontWeight={400}
                fontSize={["20px", "20px"]}
                lineHeight={1.4}
              >
                Deploy
              </Typography>
            </Box>
          </Box>
        </Box>

          <Box display={"flex"} justifyContent={"center"} mt={10}>
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
          </Box>

      </Container>
    </Box>
  );
}

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
