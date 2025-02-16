# jetson

ssh into jetson: ssh -L 7860:localhost:7860 jetson@10.19.179.6
cd jetson-containers/
docker attach <spam tab>
python3 tree_demo.py --camera 0 --resolution 640x480     ../../data/owl_image_encoder_patch32.engine

ctrl p ctrl q to detach properly