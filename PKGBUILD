# Maintainer: Stefano Capitani <stefano@manjaro.org>

_pkgbase=gnome-shell-extension-desktop-icons
pkgname=$_pkgbase-reworked
pkgver=0.1
pkgrel=1
_commit=f070ff03eb5e135a0ec3a0581ab6d1a2b8a19425
pkgdesc="Add icons to the desktop"
arch=('any')
url="https://github.com/Ste74/org.gnome.desktop-icons-reworked"
license=("LGPL3")
depends=('gnome-shell' 'gnome-shell-extensions')
conflicts=("$_pkgbase")
options=('!strip')
source=("$url/archive/$_commit.tar.gz")
sha512sums=('09056007db3e93b268788fd1edb61252629c7c99a15f142616da69869e9ba3272093e8f26785d5b68f63130cf307ad0f131e8f0dcf6c740d2b408a4cb11af027')

build() {
	cd org.gnome.desktop-icons-reworked-$_commit
    mkdir -p build
    cd build
    cmake ../
    make
}

package() {
    make -C build DESTDIR="$pkgdir" install
}
