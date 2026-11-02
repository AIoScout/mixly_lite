# camera-libs — legacy drop-in dir (unused)

The AI Eye (P4) burn no longer needs separate camera libraries: the
workshop custom core `esp32_mannual` bundles ESP32_P4_OV5647 and
ESP32_P4_IMX219 plus the esp_video SDK headers. Install that core once:

    unzip esp32_mannual.zip
    mkdir -p <mixly>/.arduino-user/hardware/esp32_mannual
    cp -R esp32_mannual/esp32p4 <mixly>/.arduino-user/hardware/esp32_mannual/

(or the classic tutorial layout ~/Documents/Arduino/hardware/esp32_mannual/
— the server checks both). The zip is linked from the workshop lab manual
(https://aioscout.io/tutorial-materials/workshop/lab-manual.html).
