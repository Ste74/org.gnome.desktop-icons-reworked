# Basic Makefile with bits inspired by dash-to-dock

UUID=org.gnome-shell.desktop-icons
GSCHEMA_FILE=org.gnome-shell.desktop-icons.gschema.xml

GIT_HEAD=$(shell git rev-parse HEAD)
LAST_RELEASE=$(shell git describe --abbrev=0 --tags --match v[0-9]*)
GIT_LAST_TAG=$(shell git show-ref -s $(LAST_RELEASE))

# define VERSION and VSTRING
ifeq ($(GIT_LAST_TAG),$(GIT_HEAD))
	VERSION=$(subst v,,$(LAST_RELEASE))
	VSTRING=$(LAST_RELEASE)
else
	VERSION=$(shell git rev-parse --short HEAD)
	VSTRING=$(VERSION)
endif

ifeq ($(strip $(INSTALL)),system) # check if INSTALL == system
	INSTALL_TYPE=system
	SHARE_PREFIX=$(DESTDIR)/usr/share
	INSTALL_BASE=$(SHARE_PREFIX)/gnome-shell/extensions
else
	INSTALL_TYPE=local
	INSTALL_BASE=~/.local/share/gnome-shell/extensions
endif

JS=*.js
MD=*.md
CSS=*.css
JSON=*.json
DIRS=schemas 

all: build

help:
	@echo "Usage: make [help | all | clean | install | jshint | compile |"
	@echo "             enable | disable | zip-file]"
	@echo ""
	@echo "all          build the project and create the build directory"
	@echo "clean        delete the build directory"
	@echo "install      install the extension"
	@echo "uninstall    uninstall the extension"
	@echo "enable       enable the extension"
	@echo "disable      disable the extension"
	@echo "jshint       run jshint"
	@echo "compile      compile the gschema xml file"
	@echo "zip-file     create a deployable zip file"
	@echo "tgz-file     create a tar.gz file"

enable:
	-gnome-shell-extension-tool -e $(UUID)

disable:
	-gnome-shell-extension-tool -d $(UUID)

clean:
	rm -f ./schemas/gschemas.compiled
	rm -rf ./build
	rm -f ./$(UUID)*.zip
	rm -f ./$(UUID)*.tar.gz
	rm -f MD5SUMS SHA1SUMS SHA256SUMS SHA512SUMS

jshint:
	jshint $(JS)

test: jshint

install: build
	mkdir -p $(INSTALL_BASE)/$(UUID)
	cp -r ./build/* $(INSTALL_BASE)/$(UUID)
ifeq ($(INSTALL_TYPE),system)
	mkdir -p $(SHARE_PREFIX)/glib-2.0/schemas 
	cp -r ./schemas/$(GSCHEMA_FILE) $(SHARE_PREFIX)/glib-2.0/schemas
endif
	rm -rf ./build

uninstall:
	rm -rf $(INSTALL_BASE)/$(UUID)
ifeq ($(INSTALL_TYPE),system)
	rm -f $(SHARE_PREFIX)/glib-2.0/schemas/$(GSCHEMA_FILE)
endif

compile:
	glib-compile-schemas ./schemas

build: compile
	mkdir -p ./build
	cp $(JS) $(CSS) $(JSON) $(MD) $(TXT) ./build
	cp -r $(DIRS) ./build

	sed -i 's/"version": -1/"version": "$(VERSION)"/'  build/metadata.json;

zip-file: build
	mv ./build ./org.gnome.desktop-icons-reworked-$(VSTRING)
	zip -qr $(UUID)_$(VSTRING).zip org.gnome.desktop-icons-reworked-$(VSTRING)
	rm -rf ./org.gnome.desktop-icons-reworked-$(VSTRING)
	$(MAKE) _checksums ARCHIVE_FILE=*.zip

tgz-file: build
	mv ./build ./org.gnome.desktop-icons-reworked-$(VSTRING)
	tar -zcf $(UUID)_$(VSTRING).tar.gz org.gnome.desktop-icons-reworked-$(VSTRING)
	rm -rf ./org.gnome.desktop-icons-reworked-$(VSTRING)
	$(MAKE) _checksums ARCHIVE_FILE=*.tar.gz

_checksums:
	md5sum $(ARCHIVE_FILE) >> MD5SUMS
	sha1sum $(ARCHIVE_FILE) >> SHA1SUMS
	sha256sum $(ARCHIVE_FILE) >> SHA256SUMS
	sha512sum $(ARCHIVE_FILE) >> SHA512SUMS

.PHONY: FORCE
FORCE:

