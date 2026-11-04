// ===============social link ========================
type SocialLink = {
  name: string;
  href: string;
  type: "image";
  src: string;
};

export const socialLinks: SocialLink[] = [
  {
    name: "GitHub",
    href: "https://github.com/janeirohurley",
    type: "image",
    src: "/github.svg",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/janeirohurley/",
    type: "image",
    src: "/linkedin.svg",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/janeirohurley/",
    type: "image",
    src: "/instagram.svg",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@janeirohurleydev8329",
    type: "image",
    src: "/youtube.svg",
  },
  {
    name: "Discord",
    href: "https://discord.com/channels/@janeirohurley",
    type: "image",
    src: "/discord.svg",
  },
];
