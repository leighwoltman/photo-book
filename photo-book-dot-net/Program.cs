using System;
using System.IO;
using System.Drawing;

namespace photo_book
{
    class point
    {
        public int x;
        public int y;
    }

    class Program
    {
        static void Main(string[] args)
        {
            if(args.Length == 0)
            {
                args = new string[9];
                args[0] = "612";
                args[1] = "792";
                args[2] = "Z:\\Documents\\GitHub\\photo-book-nodejs\\pages\\page3.png";
                args[3] = "Z:\\Documents\\GitHub\\photo-book-nodejs\\images\\DSC02347.jpg";
                args[4] = "306";
                args[5] = "0";
                args[6] = "612";
                args[7] = "396";
                args[8] = "Nothing";
            }

            // convert paramters in
            int pageWidth = Convert.ToInt32(args[0]);
            int pageHeight = Convert.ToInt32(args[1]);
            string pagePath = args[2];
            string imagePath = args[3];
            point topLeft = new point();
            topLeft.x = Convert.ToInt32(args[4]);
            topLeft.y = Convert.ToInt32(args[5]);
            point bottomRight = new point();
            bottomRight.x = Convert.ToInt32(args[6]);
            bottomRight.y = Convert.ToInt32(args[7]);
            string caption = args[8];

            // calculate the height of the text banner
            int bannerHeight = (int)Math.Floor((double)pageHeight / 40);

            // decide if the page file already exists
            if (File.Exists(pagePath))
            {
                using (Image image = Image.FromFile(pagePath))
                {
                    using (Graphics g = Graphics.FromImage(image))
                    {
                        InsertImage(g, imagePath, topLeft, bottomRight, caption, bannerHeight);
                    }
                    image.Save(pagePath.Replace(".png", "_edit.png"), System.Drawing.Imaging.ImageFormat.Jpeg);
                }

                // now delete the old one and rename the new one
                File.Delete(pagePath);
                File.Move(pagePath.Replace(".png", "_edit.png"), pagePath);
            }
            else
            {
                Bitmap bmp = new Bitmap(pageWidth, pageHeight);
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    Rectangle ImageSize = new Rectangle(0, 0, pageWidth, pageHeight);
                    g.FillRectangle(Brushes.Black, ImageSize);

                    InsertImage(g, imagePath, topLeft, bottomRight, caption, bannerHeight);
                }
                // save the image out
                bmp.Save(pagePath, System.Drawing.Imaging.ImageFormat.Png);
            }
        }

        static void InsertImage(Graphics g, string imagePath, point topLeft, point bottomRight, string caption, int bannerHeight)
        {
            Image image = Image.FromFile(imagePath);
            int slotWidth = bottomRight.x - topLeft.x;
            int slotHeight = bottomRight.y - topLeft.y;

            // determine if the aspect ratios of the spot is within 30% of each other
            double ratioSlot = (double)slotWidth / (double)slotHeight;
            double ratioImage = (double)image.Width / (double)image.Height;

            Rectangle destRect;
            Rectangle srcRect;

            double comparison = ratioSlot / ratioImage;
            if(comparison < 1.3 && comparison > 0.7)
            {
                // then we are going to just crop
                // destination will be the whole slot
                destRect = new Rectangle(topLeft.x, topLeft.y, slotWidth, slotHeight);
                // source will be the porition that fits
                if(ratioSlot < ratioImage)
                {
                    // we are width limited, image will be full height
                    int idealWidth = (int)Math.Floor(ratioSlot * image.Height);
                    // starting x
                    int startinX = (int)Math.Floor((double)(image.Width - idealWidth) / 2);
                    srcRect = new Rectangle(startinX, 0, idealWidth, image.Height);
                }
                else
                {
                    // we are height limited, image will be full width
                    int idealHeight = (int)Math.Floor(image.Width / ratioSlot);
                    // starting y
                    int startinY = (int)Math.Floor((double)(image.Height - idealHeight) / 2);
                    srcRect = new Rectangle(0, startinY, image.Width, idealHeight);
                }
            }
            else
            {
                // we want to scale the image and just center it in the slot
                if (ratioSlot > ratioImage)
                {
                    // we will be full height
                    int idealWidth = (int)Math.Floor(slotHeight * ratioImage);
                    int startinX = (int)Math.Floor((double)(slotWidth - idealWidth) / 2);
                    destRect = new Rectangle(topLeft.x + startinX, topLeft.y, idealWidth, slotHeight);
                }
                else
                {
                    // we will be full width
                    int idealHeight = (int)Math.Floor(slotWidth / ratioImage);
                    // starting y
                    int startinY = (int)Math.Floor((double)(slotHeight - idealHeight) / 2);
                    destRect = new Rectangle(topLeft.x, topLeft.y + startinY, slotWidth, idealHeight);
                }

                // source will be the entire image
                srcRect = new Rectangle(0, 0, image.Width, image.Height);
            }

            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            g.DrawImage(image, destRect, srcRect, GraphicsUnit.Pixel);
            using (Brush brush = new SolidBrush(Color.FromArgb(140, 0, 0, 0)))
            {
                g.FillRectangle(brush, new Rectangle(topLeft.x, destRect.Y + destRect.Height - bannerHeight, slotWidth, bannerHeight));
            }
            using (Font arialFont = new Font("Arial", (int)Math.Floor((double)bannerHeight/2.5)))
            {
                g.DrawString(caption, arialFont, Brushes.White, new Point(topLeft.x + 2, destRect.Y + destRect.Height - (int)(0.8 * bannerHeight)));
            }
        }
    }
}
