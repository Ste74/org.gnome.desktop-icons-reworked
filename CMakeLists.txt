cmake_minimum_required(VERSION 3.10)

set(EXT_INSTALL_DIR /usr/share/gnome-shell/extensions)
project(org.gnome.desktop-icons)
install(FILES extension.js metadata.json stylesheet.css queue.js DESTINATION ${EXT_INSTALL_DIR}/)
