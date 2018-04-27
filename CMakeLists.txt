cmake_minimum_required(VERSION 3.10)

set(EXT_INSTALL_DIR /usr/share/gnome-shell/extensions)
project(org.gnome.desktop-icons)
install(DIRECTORY org.gnome.desktop-icons DESTINATION ${EXT_INSTALL_DIR}/)
