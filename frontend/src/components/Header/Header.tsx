import * as React from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import MenuIcon from "@mui/icons-material/Menu";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { styled } from "@mui/material";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

interface Props {
  /**
   * Injected by the documentation to work in an iframe.
   * You won't need it on your project.
   */
  window?: () => Window;
}

const drawerWidth = 240;
//const navItems = ["Home", "Our Plans", "Our Services", "Contact Us"];
const navItems = [
  { label: "Home", id: 1, url: "/" },
  { label: "Our Plans", id: 2, url: "/our-plans" },
  { label: "Our Services", id: 3, url: "" },
  { label: "Contact Us", id: 4, url: "/contact-us" },
];

export default function HomeHeader(props: Props) {
  const { window } = props;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleDrawerToggle = () => {
    setMobileOpen((prevState) => !prevState);
  };

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: "center" }}>
      <Box sx={{ my: 2 }}>
        <StyledImage
          src="/images/logo.png"
          sx={{ display: "block", ml: 2, mb: 2, maxWidth: 180 }}
        />
      </Box>

      <Divider />



      <List>
  {navItems.map((item) => (
    <ListItem key={item.id} disablePadding>
      <ListItemButton
        component={Link}
        to={item.url}
        onClick={handleDrawerToggle} // Closes drawer after click
        sx={{ textAlign: "left" }}
      >
        <ListItemText primary={item.label} />
      </ListItemButton>
    </ListItem>
  ))}
</List>

      {/* <List>
        {navItems.map((item) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton sx={{ textAlign: "left" }}>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List> */}
    </Box>
  );

  const location = useLocation();

  const container =
    window !== undefined ? () => window().document.body : undefined;

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
      
        component="nav"
        sx={{ backgroundColor: "#101035", color: "#fff" }}
      >
        <Toolbar>
          <Link to="/">
            <StyledImage
              src="/images/logo.png"
              sx={{
                display: { xs: "block", sm: "none" },
                width: "150px",
                height: "auto",
                m: "22px 0 22px 0px",
              }}
            />
          </Link>

        
          <Box
            display={"flex"}
            justifyContent={"space-between"}
            alignItems={"center"}
            width={"100%"}
          >

            <Box>
              <Link to="/">
                <StyledImage
                  src="/images/logo.png"
                  sx={{
                    margin: "auto",
                    maxWidth: [150, 212],
                    height: "auto",
                    display: { xs: "none", sm: "block" },
                  }}
                />
              </Link>

            </Box>
            <Box display={"flex"} gap={[1, 3]}>
              <Box sx={{ display: { xs: "none", sm: "none", md: "flex" } }} gap={[1, 2]}>
                {/* {navItems.map((item) => (
                  <Button
                    key={item.id}
                    sx={{
                      color: "#CDCDCD",
                      fontSize: "16px",
                      textTransform: "capitalize",
                    }}
                    href={item.url}
                  >
                    {item.label}
                  </Button>
                ))} */}

                {navItems.map((item) => {
                  const isActive = location.pathname === item.url;

                  return (
                    <Button
                      key={item.id}
                      sx={{
                        color: isActive ? "#BAC2FF" : "#CDCDCD", // Only change color
                        fontSize: "16px",
                        textTransform: "capitalize",
                      }}
                      href={item.url}
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </Box>
              <Box display={"flex"} gap={[1, 3]}>
                <Button
                  variant="contained"
                  href="/signup"
                  sx={{
                    color: "#fff",
                    fontSize: "16px",
                    textTransform: "capitalize",
                    borderRadius: "40px",
                    background:
                      "linear-gradient(180deg,rgba(90, 108, 242, 1) 0%, rgba(75, 52, 152, 1) 100%)",
                  }}
                >
                  Try Free
                </Button>
                <Button
                  variant="outlined"
                  href="/login"
                  sx={{
                    fontSize: "16px",
                    color: "#fff",
                    textTransform: "capitalize",
                    borderColor: "#FFF",
                    borderRadius: "40px",
                    display: { xs: "none", sm: "inline-flex" },
                  }}
                >
                  Login
                </Button>
              </Box>
              <IconButton
                color="inherit"
                aria-label="open drawer"
                // edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 1, display: { md: "none" } }}
              >
                <MenuIcon />
              </IconButton>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
      <nav>
        <Drawer
          container={container}
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { sm: "block", md: "none" },

            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              backgroundColor: "#101035",
              color: "#fff",
            },
          }}
        >
          {drawer}
        </Drawer>
      </nav>
      {/* <Box component="main" sx={{ p: 3 }}>
        <Toolbar />
        
      </Box> */}
    </Box>
  );
}

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
