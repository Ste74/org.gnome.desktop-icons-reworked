# Maintainer: Stefano Capitani <stefano@manjaro.org>

_pkgbase=gnome-shell-extension-desktop-icons
pkgname=$_pkgbase-reworked
pkgver=0.1
pkgrel=1
_commit=dffdcd8dcc3b07518e1228bb29ebd4ee78cf9dc4
pkgdesc="Add icons to the desktop"
arch=('any')
url="https://github.com/Ste74/org.gnome.desktop-icons-reworked"
license=("LGPL3")
depends=('gnome-shell' 'gnome-shell-extensions')
conflicts=("$_pkgbase")
options=('!strip')
source=("$url/archive/$_commit.tar.gz")
sha512sums=('fe05b612d08e3df4585d07d3309a63fd220038f36374a4d0d69e531fbb2819fe555fd4f780cec48dde8e63de290a4cdb63bafecfb05116449995bc71d6de3b87')

build() {
    mkdir -p ${srcdir}/build
    cd ${srcdir}/build
    cmake ../${pkgname}
    make
}

package() {
    make -C build DESTDIR="${pkgdir}" install
}
