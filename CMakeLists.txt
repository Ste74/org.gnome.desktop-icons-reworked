cmake_minimum_required(VERSION 3.10)

project(gnome-shell-extension-desktop-icons)

set(EXT_INSTALL_DIR /usr/share/gnome-shell/extensions)
set(EXT_DIR org.gnome-shell.desktop-icons)
install(FILES extension.js 
        metadata.json
        queue.js
        stylesheet.css
        DESTINATION ${EXT_INSTALL_DIR}/${EXT_DIR}/)
