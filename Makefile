Version=0.1

PREFIX = /usr/local

EXT = $(wildcard *.json *.js *.css) 

install_common:
	install -dm0755 $(DESTDIR)$(PREFIX)/share/gnome-shell/extension/org.gnome.desktop-icons
	install -m0644 ${EXT} $(DESTDIR)$(PREFIX)/share/gnome-shell/extension/org.gnome.desktop-icons

uninstall_common:
	for f in ${EXT}; do rm -f $(DESTDIR)$(PREFIX)/share/gnome-shell/extension/org.gnome.desktop-icons/$$f; done

install: install_common

uninstall: uninstall_common 

.PHONY: install uninstall
