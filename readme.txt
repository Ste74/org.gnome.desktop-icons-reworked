Install this extension either as

 ~/.local/share/gnome-shell/extensions/org.gnome.desktop-icons

or as

 /usr/share/gnome-shell/extensions/org.gnome.desktop-icons

and enable it in Tweaks. It shows up as "desktop-icons".
You have to log out and log in again. On Xorg you could just do

 Alt F2  -> r Enter

The extension works on Wayland and on Xorg.

There are two ways to start an application from the desktop.
Either

  double left click

on the corresponding icon or do a

 right click -> Open

on it.

The extension is not notified when something changes
on the users DESKTOP directory for instance through
Files (Nautilus). You have to update by hand by doing

 right click -> Refresh

somewhere on the background.

The Icons can be rearranged by dragging and dropping them.

This extension was created in a hurry by extending the
work of Carlos Soriano such that I don't have to keep
blocking the upgrade to Gnome 3.28 on several Arch computers.

R.F.Buser                                     2018/04/02
